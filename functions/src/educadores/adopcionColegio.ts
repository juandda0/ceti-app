/**
 * Adopción del colegio (E9) calculada en el servidor: `colegios/{cid}/agregados/adopcion`.
 *
 * Las reglas solo dejan al profe leer sus propias clases, así que el panel de la
 * pestaña Colegio no puede calcular la adopción del colegio entero en el
 * cliente. Este agregado lo hace con el Admin SDK y guarda SOLO cifras: ni
 * uids, ni nombres, ni correos (cualquier profe del colegio lo lee). Además
 * guarda la lista de clases (id, nombre y grado, sin el código de ingreso) para
 * que el reporte de dominio del colegio sepa qué agregados por curso leer.
 *
 * Se recalcula:
 * - al escribir progreso (encadenado a `onProgressWriteAggregate`), como mucho
 *   una vez cada `RECALCULO_MIN_MS` por colegio, porque cada recálculo lee el
 *   progreso de todo el colegio;
 * - cada día con `adopcionDiaria`, que recoge lo que el límite anterior dejó
 *   pendiente y hace caer a los inactivos de 30 días aunque nadie escriba.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  calcularAdopcion,
  DIAS_ACTIVO,
  DIA_MS,
  type Adopcion,
  type CursoAdopcion,
} from './dominio';

export const AGREGADO_ADOPCION_ID = 'adopcion';
/** Mínimo entre dos recálculos disparados por progreso, por colegio. */
export const RECALCULO_MIN_MS = 10 * 60_000;
export const CONCURRENCIA = 4;
/** La función tiene 540 s; se deja margen para terminar lo que esté en curso. */
export const PRESUPUESTO_MS = 420_000;

export function rutaAgregadoAdopcion(colegioId: string): string {
  return `colegios/${colegioId}/agregados/${AGREGADO_ADOPCION_ID}`;
}

// ---------------------------------------------------------------------------
// Transformación pura: datos de Firestore → CursoAdopcion.
// ---------------------------------------------------------------------------

export interface DatosCursoAdopcion {
  /** `cursos/{cursoId}.profesorUids`. */
  profesorUids: unknown;
  /** Docs de `cursos/{cursoId}/estudiantes/*` (solo el estado). */
  roster: { uid: string; estado?: unknown }[];
  /** Docs de `estudiantes/{uid}/progress/*` del curso (uid y fecha). */
  progreso: { uid?: unknown; updatedAt?: unknown }[];
}

/** Una fecha de Firestore (número en ms o Timestamp) en ms; si no, null. */
export function msDe(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v && typeof v === 'object') {
    const o = v as { toMillis?: () => number; seconds?: unknown };
    if (typeof o.toMillis === 'function') return o.toMillis();
    if (typeof o.seconds === 'number') return o.seconds * 1000;
  }
  return null;
}

/**
 * - estudiantes: la lista del curso sin suprimidos ni retirados (incluye a los que aún
 *   esperan la atestación: son parte de la meta).
 * - estudiantesActivos: los de esa lista con algún mundo actualizado en los
 *   últimos 30 días.
 * - ultimaActividad: el avance más reciente de un estudiante de la lista.
 * El progreso de alguien que ya no está en la lista no cuenta. Fechas futuras
 * (relojes de cliente adelantados) se ignoran.
 */
export function cursoAdopcionDesdeDatos(d: DatosCursoAdopcion, ahora: number): CursoAdopcion {
  const desde = ahora - DIAS_ACTIVO * DIA_MS;
  const enLista = new Set(
    d.roster.filter((e) => e.estado !== 'suprimido' && e.estado !== 'retirado').map((e) => e.uid)
  );
  const activos = new Set<string>();
  let ultimaActividad: number | null = null;
  for (const p of d.progreso) {
    if (typeof p.uid !== 'string' || !enLista.has(p.uid)) continue;
    const t = msDe(p.updatedAt);
    if (t === null || t > ahora) continue;
    ultimaActividad = ultimaActividad === null ? t : Math.max(ultimaActividad, t);
    if (t >= desde) activos.add(p.uid);
  }
  const profesorUids = Array.isArray(d.profesorUids)
    ? d.profesorUids.filter((u): u is string => typeof u === 'string')
    : [];
  return {
    profesorUids,
    estudiantes: enLista.size,
    estudiantesActivos: activos.size,
    ultimaActividad,
  };
}

/** Lo que se guarda: exactamente las cifras de `Adopcion`, nada nominal. */
export function agregadoAdopcion(a: Adopcion): Adopcion {
  return {
    profes: a.profes,
    profesActivos: a.profesActivos,
    cursos: a.cursos,
    estudiantes: a.estudiantes,
    estudiantesActivos: a.estudiantesActivos,
    adopcion: a.adopcion,
    cumpleMeta: a.cumpleMeta,
    senalNave: a.senalNave,
  };
}

export interface CursoListado {
  id: string;
  nombre: string;
  grado: string;
}

/**
 * La lista de clases que ve cualquier profe del colegio: solo id, nombre y
 * grado. Nunca el código de ingreso ni los profesorUids.
 */
export function listaCursosDe(
  docs: { id: string; nombre?: unknown; grado?: unknown }[]
): CursoListado[] {
  return docs.map((d) => ({
    id: d.id,
    nombre: typeof d.nombre === 'string' ? d.nombre.slice(0, 80) : d.id,
    grado: typeof d.grado === 'string' ? d.grado : '',
  }));
}

/** ¿Ya pasó el mínimo desde el último recálculo? */
export function tocaRecalcular(actualizadoAt: unknown, ahora: number): boolean {
  const ultimo = msDe(actualizadoAt);
  return ultimo === null || ahora - ultimo >= RECALCULO_MIN_MS;
}

// ---------------------------------------------------------------------------
// Lectura y escritura.
// ---------------------------------------------------------------------------

async function datosDeCurso(
  db: Firestore,
  colegioId: string,
  cursoId: string,
  profesorUids: unknown
): Promise<DatosCursoAdopcion> {
  const [roster, progreso] = await Promise.all([
    db.collection(`colegios/${colegioId}/cursos/${cursoId}/estudiantes`).select('estado').get(),
    // Mismo índice (colegioId, cursoId) que el agregado por curso.
    db
      .collectionGroup('progress')
      .where('colegioId', '==', colegioId)
      .where('cursoId', '==', cursoId)
      .select('uid', 'updatedAt')
      .get(),
  ]);
  return {
    profesorUids,
    roster: roster.docs.map((s) => ({ uid: s.id, estado: s.get('estado') })),
    progreso: progreso.docs.map((s) => ({
      uid: s.get('uid') ?? s.ref.parent.parent?.id,
      updatedAt: s.get('updatedAt'),
    })),
  };
}

/** Recalcula y guarda la adopción de un colegio desde la fuente. */
export async function recalcularAdopcionColegio(
  colegioId: string,
  ahora = Date.now(),
  db: Firestore = getFirestore()
): Promise<Adopcion> {
  const cursos = await db
    .collection(`colegios/${colegioId}/cursos`)
    .select('profesorUids', 'nombre', 'grado')
    .get();
  const datos = await Promise.all(
    cursos.docs.map((c) => datosDeCurso(db, colegioId, c.id, c.get('profesorUids')))
  );
  const adopcion = agregadoAdopcion(
    calcularAdopcion(
      datos.map((d) => cursoAdopcionDesdeDatos(d, ahora)),
      ahora
    )
  );
  // Reemplazo completo: recalculado desde la fuente.
  await db.doc(rutaAgregadoAdopcion(colegioId)).set({
    ...adopcion,
    listaCursos: listaCursosDe(
      cursos.docs.map((c) => ({ id: c.id, nombre: c.get('nombre'), grado: c.get('grado') }))
    ),
    actualizadoAt: FieldValue.serverTimestamp(),
  });
  return adopcion;
}

/**
 * Para el disparador de progreso: recalcula solo si el agregado no se tocó en
 * los últimos `RECALCULO_MIN_MS`. Devuelve si recalculó.
 */
export async function recalcularAdopcionSiToca(
  colegioId: string,
  ahora = Date.now(),
  db: Firestore = getFirestore()
): Promise<boolean> {
  const actual = await db.doc(rutaAgregadoAdopcion(colegioId)).get();
  if (actual.exists && !tocaRecalcular(actual.get('actualizadoAt'), ahora)) return false;
  await recalcularAdopcionColegio(colegioId, ahora, db);
  return true;
}

/** Corre la tarea sobre lotes con concurrencia acotada. */
async function enLotes<T>(items: T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += n) {
    await Promise.all(items.slice(i, i + n).map(fn));
  }
}

/** Recalcula todos los colegios. Un error con uno no detiene a los demás. */
export async function correrAdopcionDiaria(ahora = Date.now(), db: Firestore = getFirestore()) {
  const inicio = Date.now();
  const cuenta = { colegios: 0, recalculados: 0, errores: 0, pendientes: 0 };
  const colegios = await db.collection('colegios').select().get();
  cuenta.colegios = colegios.size;
  await enLotes(colegios.docs, CONCURRENCIA, async (c) => {
    if (Date.now() - inicio >= PRESUPUESTO_MS) {
      cuenta.pendientes += 1;
      return;
    }
    try {
      await recalcularAdopcionColegio(c.id, ahora, db);
      cuenta.recalculados += 1;
    } catch (e) {
      cuenta.errores += 1;
      console.error('adopcionDiaria: falló un colegio', { colegioId: c.id, error: String(e) });
    }
  });
  console.log('adopcionDiaria: corrida', cuenta);
  return cuenta;
}

export const adopcionDiaria = onSchedule(
  {
    schedule: 'every day 05:00',
    timeZone: 'America/Bogota',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    await correrAdopcionDiaria();
  }
);
