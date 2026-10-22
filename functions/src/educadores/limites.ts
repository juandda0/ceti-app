/**
 * Límites por plan que hace cumplir el servidor (Ceti Educadores): clases por
 * profe, estudiantes por clase y generaciones de IA al mes. Las decisiones son
 * puras (`bloqueo*`, `cuposLibres`) y las funciones con Firestore solo cuentan y
 * lanzan el `HttpsError` con `details.codigo` que la app traduce al muro.
 *
 * Regla de producto: el muro nunca está en enseñar. Nada de aquí le quita algo
 * al estudiante (contrato A): un estudiante que ya está en la clase sigue en
 * ella aunque el plan baje; solo se frena la entrada de uno nuevo.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  FieldValue,
  getFirestore,
  type DocumentReference,
  type Firestore,
} from 'firebase-admin/firestore';
import {
  cabeEstudiante,
  iaRestante,
  limites,
  puede,
  puedeCrearClase,
  type PlanId,
} from './dominio';
import {
  licenciaDeColegio,
  mesBogota,
  planDeProfe,
  refSuscripcion,
  type LicenciaColegio,
} from './plan';

export type CodigoLimite = 'limite_clases' | 'limite_estudiantes' | 'requiere_plan' | 'limite_ia';

export interface Bloqueo {
  tipo: 'resource-exhausted' | 'failed-precondition';
  codigo: CodigoLimite;
  mensaje: string;
  /** Datos para el muro (plan actual y límite). */
  plan: PlanId;
  limite: number;
}

export const MENSAJES: Record<CodigoLimite, string> = {
  limite_clases: 'Tu plan Cadete incluye 1 clase. Pasa a Piloto para abrir más.',
  limite_estudiantes: 'Esta clase está llena. Avísale a tu profe.',
  requiere_plan: 'Crear con IA viene con el plan Piloto.',
  limite_ia: 'Ya usaste las generaciones con IA de este mes. Se renuevan el primer día del mes.',
};

// ---------------------------------------------------------------------------
// Decisiones puras.
// ---------------------------------------------------------------------------

export function bloqueoClases(plan: PlanId, clasesActuales: number): Bloqueo | null {
  if (puedeCrearClase(plan, clasesActuales)) return null;
  return {
    tipo: 'resource-exhausted',
    codigo: 'limite_clases',
    mensaje: MENSAJES.limite_clases,
    plan,
    limite: limites(plan).clases,
  };
}

export function bloqueoEstudiantes(plan: PlanId, estudiantesActuales: number): Bloqueo | null {
  if (cabeEstudiante(plan, estudiantesActuales)) return null;
  return {
    tipo: 'resource-exhausted',
    codigo: 'limite_estudiantes',
    mensaje: MENSAJES.limite_estudiantes,
    plan,
    limite: limites(plan).estudiantesPorClase,
  };
}

export function bloqueoIa(plan: PlanId, usadasEsteMes: number): Bloqueo | null {
  if (!puede(plan, 'iaAuthoring')) {
    return {
      tipo: 'failed-precondition',
      codigo: 'requiere_plan',
      mensaje: MENSAJES.requiere_plan,
      plan,
      limite: 0,
    };
  }
  if (iaRestante(plan, usadasEsteMes) > 0) return null;
  return {
    tipo: 'resource-exhausted',
    codigo: 'limite_ia',
    mensaje: MENSAJES.limite_ia,
    plan,
    limite: limites(plan).iaGeneracionesMes,
  };
}

/** Cupos que quedan en una clase con `ocupados` lugares (roster + invitaciones pendientes). */
export function cuposLibres(plan: PlanId, ocupados: number): number {
  return Math.max(0, limites(plan).estudiantesPorClase - ocupados);
}

/** El dueño de la clase es el primer profe de `profesorUids` (quien la creó). */
export function duenoDeCurso(curso: { profesorUids?: unknown } | undefined): string | null {
  const uids = curso?.profesorUids;
  if (!Array.isArray(uids)) return null;
  const primero = uids[0];
  return typeof primero === 'string' && primero.length > 0 ? primero : null;
}

export function aHttpsError(b: Bloqueo): HttpsError {
  return new HttpsError(b.tipo, b.mensaje, { codigo: b.codigo, plan: b.plan, limite: b.limite });
}

function lanzarSi(b: Bloqueo | null): void {
  if (b) throw aHttpsError(b);
}

// ---------------------------------------------------------------------------
// Clases por profe.
// ---------------------------------------------------------------------------

/** Clases del colegio donde el profe figura en `profesorUids`. */
export async function contarClasesDeProfe(
  uid: string,
  colegioId: string,
  db: Firestore = getFirestore()
): Promise<number> {
  const snap = await db
    .collection(`colegios/${colegioId}/cursos`)
    .where('profesorUids', 'array-contains', uid)
    .count()
    .get();
  return snap.data().count;
}

/** Lanza `limite_clases` si el plan del profe no admite otra clase. */
export async function asegurarPuedeCrearClase(
  uid: string,
  colegioId: string,
  db: Firestore = getFirestore()
): Promise<void> {
  const [plan, clases] = await Promise.all([
    planDeProfe(uid, colegioId, Date.now(), db),
    contarClasesDeProfe(uid, colegioId, db),
  ]);
  lanzarSi(bloqueoClases(plan, clases));
}

// ---------------------------------------------------------------------------
// Estudiantes por clase.
// ---------------------------------------------------------------------------

/** Estudiantes que ocupan cupo: todo el roster menos los suprimidos (Ley 1581). */
export async function contarRoster(
  colegioId: string,
  cursoId: string,
  db: Firestore = getFirestore()
): Promise<number> {
  const snap = await db
    .collection(`colegios/${colegioId}/cursos/${cursoId}/estudiantes`)
    .where('estado', '!=', 'suprimido')
    .count()
    .get();
  return snap.data().count;
}

/**
 * Plan que gobierna el cupo de la clase: el del dueño (`profesorUids[0]`). Una
 * clase sin profe (creada por un admin) vale lo que dé la licencia del colegio.
 */
export async function planDeCurso(
  colegioId: string,
  cursoId: string,
  db: Firestore = getFirestore()
): Promise<{ plan: PlanId; duenoUid: string | null }> {
  const snap = await db.doc(`colegios/${colegioId}/cursos/${cursoId}`).get();
  const duenoUid = duenoDeCurso(snap.data());
  if (duenoUid) return { plan: await planDeProfe(duenoUid, colegioId, Date.now(), db), duenoUid };
  const licencia = await licenciaDeColegio(colegioId, db);
  return { plan: licencia && Date.now() < licencia.hasta ? 'nave' : 'cadete', duenoUid: null };
}

/** Lanza `limite_estudiantes` si a la clase no le cabe un estudiante nuevo. */
export async function asegurarCupoEstudiante(
  colegioId: string,
  cursoId: string,
  db: Firestore = getFirestore()
): Promise<void> {
  const [{ plan }, roster] = await Promise.all([
    planDeCurso(colegioId, cursoId, db),
    contarRoster(colegioId, cursoId, db),
  ]);
  lanzarSi(bloqueoEstudiantes(plan, roster));
}

// ---------------------------------------------------------------------------
// Generaciones de IA al mes (borradores de mundo + ítems sueltos).
// ---------------------------------------------------------------------------

/** `suscripciones/{uid}/uso/{YYYY-MM}` con el campo `iaGeneraciones`. */
export function refUsoIa(
  uid: string,
  ahora = Date.now(),
  db: Firestore = getFirestore()
): DocumentReference {
  return refSuscripcion(uid, db).collection('uso').doc(mesBogota(ahora));
}

export async function usoIaDelMes(
  uid: string,
  ahora = Date.now(),
  db: Firestore = getFirestore()
): Promise<number> {
  const snap = await refUsoIa(uid, ahora, db).get();
  const n = snap.exists ? snap.data()?.iaGeneraciones : 0;
  return typeof n === 'number' ? n : 0;
}

/**
 * Lanza `requiere_plan` o `limite_ia` si el profe no puede generar ahora.
 * Devuelve el plan para quien lo necesite. No consume cupo: eso lo hace
 * `registrarGeneracionIa` solo cuando la generación sale bien.
 */
export async function asegurarIaDisponible(
  uid: string,
  colegioId: string | null | undefined,
  db: Firestore = getFirestore()
): Promise<PlanId> {
  const ahora = Date.now();
  const [plan, usadas] = await Promise.all([
    planDeProfe(uid, colegioId, ahora, db),
    usoIaDelMes(uid, ahora, db),
  ]);
  lanzarSi(bloqueoIa(plan, usadas));
  return plan;
}

/** Suma una generación al contador del mes (Bogotá). */
export async function registrarGeneracionIa(
  uid: string,
  db: Firestore = getFirestore()
): Promise<void> {
  const ahora = Date.now();
  await refUsoIa(uid, ahora, db).set(
    { iaGeneraciones: FieldValue.increment(1), mes: mesBogota(ahora), actualizadoAt: ahora },
    { merge: true }
  );
}

// ---------------------------------------------------------------------------
// Licencia Nave del colegio (la activa un admin de Ceti tras firmar el contrato).
// ---------------------------------------------------------------------------

/** Valida la entrada de activarLicenciaNave. Puro: lanza `invalid-argument`. */
export function leerLicenciaNave(
  data: unknown,
  ahora: number
): { colegioId: string; licencia: LicenciaColegio } {
  const d = (data ?? {}) as Record<string, unknown>;
  const colegioId = typeof d.colegioId === 'string' ? d.colegioId.trim() : '';
  if (!colegioId || colegioId.includes('/')) {
    throw new HttpsError('invalid-argument', "Missing or invalid 'colegioId'.");
  }
  const estudiantes = d.estudiantes;
  if (typeof estudiantes !== 'number' || !Number.isInteger(estudiantes) || estudiantes < 1) {
    throw new HttpsError('invalid-argument', "'estudiantes' debe ser un entero mayor que 0.");
  }
  const hasta = d.hastaMs;
  if (typeof hasta !== 'number' || !Number.isFinite(hasta) || hasta <= ahora) {
    throw new HttpsError('invalid-argument', "'hastaMs' debe ser una fecha futura en ms.");
  }
  const padrino = typeof d.padrino === 'string' && d.padrino.trim() ? d.padrino.trim() : null;
  return { colegioId, licencia: { plan: 'nave', hasta, estudiantes, padrino } };
}

/** activarLicenciaNave({colegioId, estudiantes, hastaMs, padrino?}). Solo admin. */
export const activarLicenciaNave = onCall(async (request) => {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (caller.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un admin activa licencias.');
  }
  const { colegioId, licencia } = leerLicenciaNave(request.data, Date.now());
  const ref = getFirestore().doc(`colegios/${colegioId}`);
  if (!(await ref.get()).exists) {
    throw new HttpsError('not-found', `No existe el colegio '${colegioId}'.`);
  }
  // update reemplaza el mapa entero: una renovación no hereda un padrino viejo.
  await ref.update({
    licencia,
    licenciaActualizadaPor: caller.uid,
    licenciaActualizadaAt: Date.now(),
  });
  return { ok: true, colegioId, licencia };
});
