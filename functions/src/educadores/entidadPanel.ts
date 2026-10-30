/**
 * Fase 6 — panel de la entidad y su escala de notas y periodos.
 *
 * - `verPanelEntidad`: lo pide un admin de la entidad. Calcula con el Admin SDK
 *   las cifras de grupo de todas las clases (dominio/panelEntidad.ts) y las
 *   guarda en `colegios/{cid}/agregados/entidad` como caché de 10 minutos (lo
 *   lee solo un admin). Nada nominal de estudiantes: de la comunicación solo
 *   cuenta envíos y familias con resumen, nunca textos ni correos.
 * - `guardarEvaluacionEntidad`: un admin guarda la escala SIEE y los periodos
 *   en `colegios/{cid}/config/evaluacion` (lo leen los profes de la entidad).
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  DIA_MS,
  MENSAJES_ERROR_EVALUACION,
  calcularPanelEntidad,
  leerEvaluacion,
  licenciaVigente,
  type CompetenciaCurso,
  type CursoPanel,
  type PanelEntidad,
} from './dominio';
import { cursoAdopcionDesdeDatos, datosDeCurso } from './adopcionColegio';
import { leerEntidad, type EstadoEntidad } from './entidades';

export const CACHE_PANEL_MS = 10 * 60_000;
const CONCURRENCIA = 4;

export const rutaPanelEntidad = (cid: string) => `colegios/${cid}/agregados/entidad`;

async function porTandas<T, R>(items: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += n) out.push(...(await Promise.all(items.slice(i, i + n).map(f))));
  return out;
}

async function cursoPanel(
  db: Firestore,
  cid: string,
  c: FirebaseFirestore.QueryDocumentSnapshot,
  ahora: number
): Promise<CursoPanel> {
  const base = `colegios/${cid}/cursos/${c.id}`;
  const [datos, resumen, comunicados] = await Promise.all([
    datosDeCurso(db, cid, c.id, c.get('profesorUids')),
    db.doc(`${base}/agregados/resumen`).get(),
    db.collection(`${base}/comunicados`).where('creadoAt', '>=', ahora - 7 * DIA_MS).count().get(),
  ]);
  const adopcion = cursoAdopcionDesdeDatos(datos, ahora);
  const enClase = datos.roster.filter((e) => e.estado !== 'suprimido' && e.estado !== 'retirado');
  const acudientes =
    enClase.length === 0
      ? []
      : await db.getAll(...enClase.map((e) => db.doc(`${base}/estudiantes/${e.uid}/acudiente/datos`)));
  const familiasConResumen = acudientes.filter((a) => a.exists && (!!a.get('token') || a.get('correoActivo') === true)).length;
  const porCompetenciaIn = (resumen.get('porCompetencia') ?? {}) as Record<string, Partial<CompetenciaCurso>>;
  const porCompetencia: Record<string, CompetenciaCurso> = {};
  for (const [id, v] of Object.entries(porCompetenciaIn)) {
    if (typeof v?.masteryPromedio === 'number' && typeof v?.estudiantes === 'number') {
      porCompetencia[id] = { masteryPromedio: v.masteryPromedio, estudiantes: v.estudiantes };
    }
  }
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
    porCompetencia,
    comunicados7d: comunicados.data().count,
    familiasConResumen,
  };
}

export async function calcularPanelDeEntidad(db: Firestore, e: EstadoEntidad, ahora = Date.now()): Promise<PanelEntidad> {
  const cursos = await db.collection(`colegios/${e.colegioId}/cursos`).get();
  const filas = await porTandas(cursos.docs, CONCURRENCIA, (c) => cursoPanel(db, e.colegioId, c, ahora));
  return calcularPanelEntidad(
    filas,
    e.profes.map((p) => ({ uid: p.uid, nombre: p.nombre, rol: p.rol })),
    ahora
  );
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
  const ref = db.doc(rutaPanelEntidad(cid));
  if (request.data?.forzar !== true) {
    const cache = await ref.get();
    const at = cache.get('calculadoAt');
    if (cache.exists && typeof at === 'number' && ahora - at < CACHE_PANEL_MS) return cache.data() as PanelEntidad;
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
