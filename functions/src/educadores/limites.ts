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
import { defineString } from 'firebase-functions/params';
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
import { COL_MAIL, construirCorreo } from './correo';
import { ESTADOS_EN_CLASE, contarClasesActivas } from './gestionClase';

/**
 * Buzón de operaciones. Es el mismo parámetro que declara suscripciones.ts
 * (firebase-functions registra un parámetro una vez por nombre); se repite
 * aquí para no cargar el módulo de cobros en cada unión de un estudiante.
 */
const OPS_POR_DEFECTO = 'juandiegodiazave@gmail.com';
const CETI_OPS_EMAIL = defineString('CETI_OPS_EMAIL', { default: OPS_POR_DEFECTO });

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

/** Lo ve el estudiante cuando su colegio (licencia Nave) pasó el tope con margen. */
export const MENSAJE_COLEGIO_LLENO =
  'Tu colegio ya llenó sus cupos en Ceti por ahora. Avísale a tu profe y vuelve a intentarlo pronto: no pierdes nada.';

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

/** Clases sin archivar del colegio donde el profe figura en `profesorUids`. */
export async function contarClasesDeProfe(
  uid: string,
  colegioId: string,
  db: Firestore = getFirestore()
): Promise<number> {
  return contarClasesActivas(db, uid, colegioId);
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

/**
 * Estudiantes que ocupan cupo: los que siguen en la clase (activos o
 * pendientes). Los suprimidos (Ley 1581) y los retirados no cuentan.
 */
export async function contarRoster(
  colegioId: string,
  cursoId: string,
  db: Firestore = getFirestore()
): Promise<number> {
  const snap = await db
    .collection(`colegios/${colegioId}/cursos/${cursoId}/estudiantes`)
    .where('estado', 'in', [...ESTADOS_EN_CLASE])
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

/**
 * Lanza `limite_estudiantes` si a la clase no le cabe un estudiante nuevo, o si
 * el colegio tiene Nave vigente y ya pasó el tope con margen. Si la entrada lo
 * deja dentro del margen, entra igual y se avisa a operaciones (una vez).
 */
export async function asegurarCupoEstudiante(
  colegioId: string,
  cursoId: string,
  db: Firestore = getFirestore()
): Promise<void> {
  const [{ plan }, roster, nave] = await Promise.all([
    planDeCurso(colegioId, cursoId, db),
    contarRoster(colegioId, cursoId, db),
    naveDeColegio(colegioId, Date.now(), db),
  ]);
  lanzarSi(bloqueoEstudiantes(plan, roster));
  if (!nave) return;
  const cupo = cupoNave(nave.estudiantes, await contarEstudiantesColegio(colegioId, db));
  lanzarSi(bloqueoNave(cupo));
  if (pasaLicencia(cupo, 1)) await avisarCupoNave(colegioId, nave, cupo, 1, db);
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

/** La licencia Nave si está vigente en `ahora`. Puro. */
export function naveVigente(
  licencia: LicenciaColegio | null | undefined,
  ahora: number
): LicenciaColegio | null {
  return licencia && licencia.plan === 'nave' && ahora < licencia.hasta ? licencia : null;
}

/** Cuántos estudiantes por encima de la licencia se dejan entrar: 10 %, al menos 1. */
export function margenNave(licenciados: number): number {
  return Math.max(1, Math.ceil(licenciados / 10));
}

export interface CupoNave {
  /** Estudiantes del contrato (`licencia.estudiantes`). */
  licenciados: number;
  /** Licenciados + margen: pasado esto, nadie nuevo entra. */
  tope: number;
  /** Lo que ya ocupa cupo en todo el colegio. */
  ocupados: number;
  /** Cuántos más caben antes del tope. */
  libres: number;
}

/** Conteo del cupo de la licencia frente a lo ocupado en todo el colegio. Puro. */
export function cupoNave(licenciados: number, ocupados: number): CupoNave {
  const tope = licenciados + margenNave(licenciados);
  return { licenciados, tope, ocupados, libres: Math.max(0, tope - ocupados) };
}

/** Si al admitir `nuevos` el colegio queda por encima de su licencia (hay que avisar). Puro. */
export function pasaLicencia(cupo: CupoNave, nuevos: number): boolean {
  return nuevos > 0 && cupo.ocupados + nuevos > cupo.licenciados;
}

/** `limite_estudiantes` del colegio, con el mensaje para el estudiante. Puro. */
export function bloqueoNave(cupo: CupoNave): Bloqueo | null {
  if (cupo.libres > 0) return null;
  return {
    tipo: 'resource-exhausted',
    codigo: 'limite_estudiantes',
    mensaje: MENSAJE_COLEGIO_LLENO,
    plan: 'nave',
    limite: cupo.licenciados,
  };
}

export async function naveDeColegio(
  colegioId: string,
  ahora = Date.now(),
  db: Firestore = getFirestore()
): Promise<LicenciaColegio | null> {
  return naveVigente(await licenciaDeColegio(colegioId, db), ahora);
}

/**
 * Estudiantes que ocupan cupo en todo el colegio: los que siguen en
 * cada clase y, con `conPendientes`, también las invitaciones pendientes (así
 * invitarLista no reparte más cupos de los que hay).
 */
export async function contarEstudiantesColegio(
  colegioId: string,
  db: Firestore = getFirestore(),
  { conPendientes = false }: { conPendientes?: boolean } = {}
): Promise<number> {
  const cursos = await db.collection(`colegios/${colegioId}/cursos`).select().get();
  const porCurso = await Promise.all(
    cursos.docs.map(async (c) => {
      const [roster, pendientes] = await Promise.all([
        contarRoster(colegioId, c.id, db),
        conPendientes
          ? c.ref
              .collection('invitados')
              .where('estado', '==', 'pendiente')
              .count()
              .get()
              .then((s) => s.data().count)
          : 0,
      ]);
      return roster + pendientes;
    })
  );
  return porCurso.reduce((a, b) => a + b, 0);
}

/**
 * Encola 'nave_cupo_ops' una sola vez por licencia: la marca
 * `colegios/{cid}.avisoCupoNave.clave` = `{hasta}_{estudiantes}`, así que una
 * renovación o ampliación vuelve a armar el aviso. Nunca lanza: el estudiante
 * entra aunque el correo falle.
 */
export async function avisarCupoNave(
  colegioId: string,
  licencia: LicenciaColegio,
  cupo: CupoNave,
  nuevos: number,
  db: Firestore = getFirestore()
): Promise<boolean> {
  try {
    const ref = db.doc(`colegios/${colegioId}`);
    const clave = `${licencia.hasta}_${licencia.estudiantes}`;
    const ocupados = cupo.ocupados + nuevos;
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.get('avisoCupoNave.clave') === clave) return false;
      const nombre = snap.get('nombre');
      // Marca y correo en la misma transacción: o salen los dos o ninguno.
      tx.set(db.collection(COL_MAIL).doc(), {
        to: CETI_OPS_EMAIL.value() || OPS_POR_DEFECTO,
        message: construirCorreo('nave_cupo_ops', {
          colegioId,
          colegio: typeof nombre === 'string' ? nombre : null,
          licenciados: cupo.licenciados,
          ocupados,
          tope: cupo.tope,
          fecha: licencia.hasta,
          padrino: licencia.padrino ?? null,
        }),
      });
      tx.set(ref, { avisoCupoNave: { clave, ocupados, avisadoAt: Date.now() } }, { merge: true });
      return true;
    });
  } catch (e) {
    console.error('avisarCupoNave: no se pudo avisar a operaciones', {
      colegioId,
      error: String(e),
    });
    return false;
  }
}

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
