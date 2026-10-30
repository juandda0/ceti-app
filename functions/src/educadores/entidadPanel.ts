/**
 * Fase 6 — panel de la entidad y su escala de notas y periodos.
 *
 * - `verPanelEntidad`: lo pide un admin de la entidad. Calcula con el Admin SDK
 *   las cifras de grupo de todas las clases desde el avance de los estudiantes
 *   (dominio/panelEntidad.ts): adopción, dominio y cobertura de las
 *   orientaciones del MEN por grado o programa (dominio/normativa.ts). Sin
 *   periodo, lo guarda en `colegios/{cid}/agregados/entidad` como caché de 10
 *   minutos (lo lee solo un admin); con `desde`/`hasta` (el informe de
 *   cobertura de un periodo) calcula aparte. Nada nominal de estudiantes: de la
 *   comunicación solo cuenta envíos y familias con resumen, nunca textos ni
 *   correos.
 * - `guardarEvaluacionEntidad`: un admin guarda la escala SIEE y los periodos
 *   en `colegios/{cid}/config/evaluacion` (lo leen los profes de la entidad).
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  DIA_MS,
  MENSAJES_ERROR_EVALUACION,
  calcularPanelEntidad,
  dominiosDeCurso,
  leerEvaluacion,
  licenciaVigente,
  type CursoPanel,
  type PanelEntidad,
  type ProgresoPanel,
} from './dominio';
import { cursoAdopcionDesdeDatos, msDe } from './adopcionColegio';
import { leerEntidad, type EstadoEntidad } from './entidades';

export const CACHE_PANEL_MS = 10 * 60_000;
const CONCURRENCIA = 4;

export const rutaPanelEntidad = (cid: string) => `colegios/${cid}/agregados/entidad`;

async function porTandas<T, R>(items: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += n) out.push(...(await Promise.all(items.slice(i, i + n).map(f))));
  return out;
}

type Rango = { desde: number; hasta: number } | null;

async function cursoPanel(
  db: Firestore,
  cid: string,
  c: FirebaseFirestore.QueryDocumentSnapshot,
  ahora: number,
  rango: Rango
): Promise<CursoPanel> {
  const base = `colegios/${cid}/cursos/${c.id}`;
  const [roster, progresoSnap, comunicados] = await Promise.all([
    db.collection(`${base}/estudiantes`).select('estado').get(),
    // Mismo índice (colegioId, cursoId) que el agregado por curso.
    db
      .collectionGroup('progress')
      .where('colegioId', '==', cid)
      .where('cursoId', '==', c.id)
      .select('uid', 'updatedAt', 'competencia', 'mastery')
      .get(),
    db.collection(`${base}/comunicados`).where('creadoAt', '>=', ahora - 7 * DIA_MS).count().get(),
  ]);
  const progreso: ProgresoPanel[] = progresoSnap.docs.map((s) => ({
    uid: String(s.get('uid') ?? s.ref.parent.parent?.id ?? ''),
    competencia: typeof s.get('competencia') === 'string' ? s.get('competencia') : 'desconocida',
    mastery: typeof s.get('mastery') === 'number' ? s.get('mastery') : 0,
    updatedAt: msDe(s.get('updatedAt')),
  }));
  const rosterDatos = roster.docs.map((s) => ({ uid: s.id, estado: s.get('estado') }));
  const adopcion = cursoAdopcionDesdeDatos({ profesorUids: c.get('profesorUids'), roster: rosterDatos, progreso }, ahora);
  const enClase = rosterDatos.filter((e) => e.estado !== 'suprimido' && e.estado !== 'retirado');
  const acudientes =
    enClase.length === 0
      ? []
      : await db.getAll(...enClase.map((e) => db.doc(`${base}/estudiantes/${e.uid}/acudiente/datos`)));
  const familiasConResumen = acudientes.filter((a) => a.exists && (!!a.get('token') || a.get('correoActivo') === true)).length;
  return {
    id: c.id,
    nombre: String(c.get('nombre') ?? c.id),
    grado: String(c.get('grado') ?? ''),
    programa: typeof c.get('programa') === 'string' ? c.get('programa') : null,
    profesorUids: adopcion.profesorUids,
    archivada: c.get('archivada') === true,
    estudiantes: adopcion.estudiantes,
    estudiantesActivos: adopcion.estudiantesActivos,
    ultimaActividad: adopcion.ultimaActividad,
    ...dominiosDeCurso(progreso, new Set(enClase.map((e) => e.uid)), rango),
    comunicados7d: comunicados.data().count,
    familiasConResumen,
  };
}

export async function calcularPanelDeEntidad(
  db: Firestore,
  e: EstadoEntidad,
  ahora = Date.now(),
  rango: Rango = null
): Promise<PanelEntidad> {
  const cursos = await db.collection(`colegios/${e.colegioId}/cursos`).get();
  const filas = await porTandas(cursos.docs, CONCURRENCIA, (c) => cursoPanel(db, e.colegioId, c, ahora, rango));
  return calcularPanelEntidad(
    filas,
    e.profes.map((p) => ({ uid: p.uid, nombre: p.nombre, rol: p.rol })),
    ahora,
    rango
  );
}

/** {desde, hasta} en ms si vienen bien; si no, null (todo el historial). */
export function leerRango(data: unknown): Rango {
  const d = (data ?? {}) as Record<string, unknown>;
  const desde = d.desde;
  const hasta = d.hasta;
  if (typeof desde !== 'number' || typeof hasta !== 'number' || !Number.isFinite(desde) || !Number.isFinite(hasta) || desde > hasta) {
    return null;
  }
  return { desde, hasta };
}

function exigirAdminDeEntidad(e: EstadoEntidad, uid: string): void {
  if (!e.entidad) throw new HttpsError('failed-precondition', 'Tu colegio todavía no es una entidad.');
  if (e.profes.find((p) => p.uid === uid)?.rol !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un admin de la entidad.');
  }
}

function colegioDe(token: Record<string, unknown> | undefined): string {
  if (token?.role !== 'profesor' || typeof token.colegioId !== 'string' || !token.colegioId) {
    throw new HttpsError('permission-denied', 'Solo para profes de una entidad.');
  }
  return token.colegioId;
}

/** Panel de la entidad (admin). `forzar` salta la caché de 10 minutos. */
export const verPanelEntidad = onCall(async (request): Promise<PanelEntidad> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const cid = colegioDe(request.auth.token);
  const db = getFirestore();
  const e = await leerEntidad(db, cid);
  exigirAdminDeEntidad(e, request.auth.uid);
  const ahora = Date.now();
  if (!licenciaVigente(e.licencia, ahora)) {
    throw new HttpsError('failed-precondition', 'El panel viene con el plan de la entidad.', { codigo: 'requiere_plan' });
  }
  // Con periodo (informe de cobertura) se calcula aparte y no toca la caché.
  const rango = leerRango(request.data);
  if (rango) return calcularPanelDeEntidad(db, e, ahora, rango);
  const ref = db.doc(rutaPanelEntidad(cid));
  if (request.data?.forzar !== true) {
    const cache = await ref.get();
    const at = cache.get('calculadoAt');
    // Un caché de antes de la cobertura (Fase 6, normativa) se recalcula.
    if (cache.exists && typeof at === 'number' && ahora - at < CACHE_PANEL_MS && Array.isArray(cache.get('cobertura'))) {
      return cache.data() as PanelEntidad;
    }
  }
  const panel = await calcularPanelDeEntidad(db, e, ahora);
  await ref.set(panel);
  return panel;
});

/** Escala SIEE y periodos de toda la entidad (admin). */
export const guardarEvaluacionEntidad = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const cid = colegioDe(request.auth.token);
  const db = getFirestore();
  exigirAdminDeEntidad(await leerEntidad(db, cid), request.auth.uid);
  const r = leerEvaluacion(request.data?.config);
  if (!r.ok) throw new HttpsError('invalid-argument', MENSAJES_ERROR_EVALUACION[r.error], { codigo: r.error });
  const config = { ...r.config, actualizadoAt: Date.now(), actualizadoPor: request.auth.uid };
  await db.doc(`colegios/${cid}/config/evaluacion`).set(config);
  return { ok: true, config };
});
