/**
 * Fase 9 — tareas abiertas con rúbrica y muro de preguntas (ver
 * dominio/rubricas.ts y dominio/muroClase.ts). Todo pasa por estos callables;
 * las reglas solo dejan leer.
 *
 * - `gestionarTareaAbierta`: crear, editar, cerrar, abrir o borrar una tarea.
 *   Quien edita la clase; crear y editar con el plan `rubricas` (Piloto o más).
 * - `entregarTareaAbierta`: el estudiante activo responde (o corrige su
 *   respuesta) mientras la tarea está abierta y nadie la ha calificado.
 * - `calificarEntrega`: cualquier profe de la clase, también quien solo ve y
 *   califica. La nota sale de los puntos en la escala del SIEE de la entidad.
 * - `sugerirCalificacion`: la IA propone un nivel por criterio con una frase de
 *   por qué; el profe decide. Gasta la cuota de IA del plan.
 * - `muroClase`: preguntar (estudiante), publicar, ocultar, responder y borrar
 *   (profes de la clase), y encender o apagar el muro (quien edita).
 */
import { randomBytes } from 'node:crypto';
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  MAX_RESPUESTA,
  MAX_RESPUESTA_MURO,
  MAX_PREGUNTA_MURO,
  MENSAJES_ERROR_MURO,
  MENSAJES_ERROR_TAREA,
  SYSTEM_PROMPT_RUBRICA,
  calificar,
  evaluacionDesdeDoc,
  leerSugerencia,
  leerTarea,
  limpiarTextoMuro,
  nombreEnMuro,
  puede,
  puedePreguntar,
  textoParaIa,
  type EscalaSiee,
  type PreguntaMuro,
  type SugerenciaCriterio,
  type TareaAbierta,
} from './dominio';
import { exigirPermiso } from './permisos';
import { planDeProfe } from './plan';
import { asegurarIaDisponible, registrarGeneracionIa } from './limites';
import { groqCaller, type ModelCaller } from '../modelProvider';

const GROQ_API_KEY = defineSecret('GROQ_API_KEY');

type Auth = CallableRequest['auth'];

const rutaCurso = (cid: string, k: string) => `colegios/${cid}/cursos/${k}`;
export const rutaTarea = (cid: string, k: string, id: string) => `${rutaCurso(cid, k)}/tareasAbiertas/${id}`;
export const rutaMuro = (cid: string, k: string) => `${rutaCurso(cid, k)}/muro`;

const idValido = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);

function profe(auth: Auth) {
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const cid = auth.token.colegioId;
  if (auth.token.role !== 'profesor' || typeof cid !== 'string' || !cid) {
    throw new HttpsError('permission-denied', 'Solo para profes.');
  }
  return { uid: auth.uid, cid };
}

/** El estudiante y el colegio de la clase según su token (hasta 5 clases). */
function estudiante(auth: Auth, cursoId: string) {
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (auth.token.role !== 'estudiante') throw new HttpsError('permission-denied', 'Solo para estudiantes.');
  const clases = (auth.token.clases ?? {}) as Record<string, string>;
  const cid = clases[cursoId] ?? (auth.token.cursoId === cursoId ? (auth.token.colegioId as string | undefined) : undefined);
  if (typeof cid !== 'string' || !cid) throw new HttpsError('permission-denied', 'No estás en esa clase.');
  return { uid: auth.uid, cid };
}

async function exigirActivo(db: Firestore, cid: string, k: string, uid: string) {
  const est = await db.doc(`${rutaCurso(cid, k)}/estudiantes/${uid}`).get();
  if (!est.exists || est.get('estado') !== 'activo') {
    throw new HttpsError('permission-denied', 'Tu profe aún no confirma tu autorización.');
  }
  return est;
}

function cursoDe(data: unknown): string {
  const k = (data as { cursoId?: unknown } | null)?.cursoId;
  if (!idValido(k)) throw new HttpsError('invalid-argument', 'Falta la clase.');
  return k;
}

async function escalaDe(db: Firestore, cid: string): Promise<EscalaSiee> {
  const s = await db.doc(`colegios/${cid}/config/evaluacion`).get();
  return evaluacionDesdeDoc(s.exists ? s.data() : null).escala;
}

// ---------------------------------------------------------------------------
// Tareas abiertas
// ---------------------------------------------------------------------------

export async function gestionarTareaEnClase(db: Firestore, auth: Auth, data: Record<string, unknown>, ahora = Date.now()) {
  const p = profe(auth);
  const k = cursoDe(data);
  const curso = await db.doc(rutaCurso(p.cid, k)).get();
  exigirPermiso(curso, p.uid, 'tareas');
  const accion = data.accion;
  if (accion === 'crear' || accion === 'editar') {
    const plan = await planDeProfe(p.uid, p.cid, ahora, db);
    if (!puede(plan, 'rubricas')) {
      throw new HttpsError('failed-precondition', 'Las tareas abiertas con rúbrica vienen con el plan Piloto.', {
        codigo: 'requiere_plan',
        funcion: 'rubricas',
        plan,
      });
    }
    const r = leerTarea(data.tarea, ahora);
    if (!r.ok) throw new HttpsError('invalid-argument', MENSAJES_ERROR_TAREA[r.error], { codigo: r.error });
    if (accion === 'crear') {
      const id = randomBytes(8).toString('hex');
      const tarea: TareaAbierta = { ...r.tarea, estado: 'abierta', creadaPor: p.uid, creadaAt: ahora };
      await db.doc(rutaTarea(p.cid, k, id)).set(tarea);
      return { ok: true, id };
    }
    if (!idValido(data.tareaId)) throw new HttpsError('invalid-argument', 'Falta la tarea.');
    const ref = db.doc(rutaTarea(p.cid, k, data.tareaId));
    const actual = await ref.get();
    if (!actual.exists) throw new HttpsError('not-found', 'Esa tarea ya no existe.');
    // Con entregas calificadas no se cambia la rúbrica (cambiaría las notas).
    const calificadas = await ref.collection('entregas').where('calificada', '==', true).limit(1).get();
    const rubrica = calificadas.empty ? r.tarea.rubrica : (actual.get('rubrica') as TareaAbierta['rubrica']);
    await ref.update({ ...r.tarea, rubrica });
    return { ok: true, id: data.tareaId, rubricaFija: !calificadas.empty };
  }
  if (!idValido(data.tareaId)) throw new HttpsError('invalid-argument', 'Falta la tarea.');
  const ref = db.doc(rutaTarea(p.cid, k, data.tareaId));
  if (!(await ref.get()).exists) throw new HttpsError('not-found', 'Esa tarea ya no existe.');
  if (accion === 'cerrar' || accion === 'abrir') {
    await ref.update({ estado: accion === 'cerrar' ? 'cerrada' : 'abierta' });
    return { ok: true, id: data.tareaId };
  }
  if (accion === 'borrar') {
    await db.recursiveDelete(ref);
    return { ok: true, id: data.tareaId };
  }
  throw new HttpsError('invalid-argument', 'Acción inválida.');
}

export async function entregarEnClase(db: Firestore, auth: Auth, data: Record<string, unknown>, ahora = Date.now()) {
  const k = cursoDe(data);
  const e = estudiante(auth, k);
  if (!idValido(data.tareaId)) throw new HttpsError('invalid-argument', 'Falta la tarea.');
  await exigirActivo(db, e.cid, k, e.uid);
  const tarea = await db.doc(rutaTarea(e.cid, k, data.tareaId)).get();
  if (!tarea.exists) throw new HttpsError('not-found', 'Esa tarea ya no existe.');
  if (tarea.get('estado') !== 'abierta') throw new HttpsError('failed-precondition', 'Tu profe ya cerró esta tarea.');
  const texto = typeof data.texto === 'string' ? data.texto.replace(/\r/g, '').trim() : '';
  if (!texto) throw new HttpsError('invalid-argument', 'Escribe tu respuesta.');
  if (texto.length > MAX_RESPUESTA) throw new HttpsError('invalid-argument', `Tu respuesta va hasta ${MAX_RESPUESTA} caracteres.`);
  const ref = tarea.ref.collection('entregas').doc(e.uid);
  await db.runTransaction(async (tx) => {
    const actual = await tx.get(ref);
    if (actual.exists && actual.get('calificada') === true) {
      throw new HttpsError('failed-precondition', 'Tu profe ya calificó esta respuesta.');
    }
    tx.set(ref, { uid: e.uid, texto, entregadaAt: ahora, calificada: false, calificacion: null });
  });
  return { ok: true };
}

async function tareaYEntrega(db: Firestore, cid: string, k: string, tareaId: unknown, uid: unknown) {
  if (!idValido(tareaId) || !idValido(uid)) throw new HttpsError('invalid-argument', 'Falta la tarea o el estudiante.');
  const tarea = await db.doc(rutaTarea(cid, k, tareaId)).get();
  if (!tarea.exists) throw new HttpsError('not-found', 'Esa tarea ya no existe.');
  const entrega = await tarea.ref.collection('entregas').doc(uid).get();
  if (!entrega.exists) throw new HttpsError('not-found', 'Ese estudiante no ha entregado.');
  return { tarea, entrega };
}

export async function calificarEnClase(db: Firestore, auth: Auth, data: Record<string, unknown>, ahora = Date.now()) {
  const p = profe(auth);
  const k = cursoDe(data);
  const curso = await db.doc(rutaCurso(p.cid, k)).get();
  exigirPermiso(curso, p.uid, 'calificar');
  const { tarea, entrega } = await tareaYEntrega(db, p.cid, k, data.tareaId, data.uid);
  const niveles = Array.isArray(data.niveles) ? (data.niveles as unknown[]).map((n) => (typeof n === 'number' ? n : null)) : [];
  const comentario = typeof data.comentario === 'string' ? data.comentario : '';
  const c = calificar(tarea.get('rubrica') as TareaAbierta['rubrica'], niveles, comentario, p.uid, ahora, await escalaDe(db, p.cid));
  if (!c) throw new HttpsError('invalid-argument', 'Elige un nivel en cada criterio.');
  await entrega.ref.update({ calificacion: c, calificada: true });
  return { ok: true, calificacion: c };
}

export async function sugerirEnClase(
  db: Firestore,
  auth: Auth,
  data: Record<string, unknown>,
  llamar: ModelCaller
): Promise<{ sugerencia: SugerenciaCriterio[] }> {
  const p = profe(auth);
  const k = cursoDe(data);
  const curso = await db.doc(rutaCurso(p.cid, k)).get();
  exigirPermiso(curso, p.uid, 'calificar');
  const { tarea, entrega } = await tareaYEntrega(db, p.cid, k, data.tareaId, data.uid);
  await asegurarIaDisponible(p.uid, p.cid, db);
  const t = tarea.data() as TareaAbierta;
  let sugerencia: SugerenciaCriterio[] | null = null;
  try {
    const raw = await llamar(SYSTEM_PROMPT_RUBRICA, textoParaIa(t, String(entrega.get('texto') ?? '')));
    sugerencia = leerSugerencia(JSON.parse(raw), t.rubrica.criterios.length);
  } catch (e) {
    console.error('sugerirCalificacion: fallo', e instanceof Error ? e.message : e);
  }
  if (!sugerencia) throw new HttpsError('unavailable', 'La IA no pudo sugerir ahora. Califica tú o intenta de nuevo.');
  await registrarGeneracionIa(p.uid, db);
  return { sugerencia };
}

export const gestionarTareaAbierta = onCall((r) => gestionarTareaEnClase(getFirestore(), r.auth, (r.data ?? {}) as Record<string, unknown>));
export const entregarTareaAbierta = onCall((r) => entregarEnClase(getFirestore(), r.auth, (r.data ?? {}) as Record<string, unknown>));
export const calificarEntrega = onCall((r) => calificarEnClase(getFirestore(), r.auth, (r.data ?? {}) as Record<string, unknown>));
export const sugerirCalificacion = onCall({ secrets: [GROQ_API_KEY] }, (r) =>
  sugerirEnClase(
    getFirestore(),
    r.auth,
    (r.data ?? {}) as Record<string, unknown>,
    groqCaller(GROQ_API_KEY.value(), { maxTokens: 600, timeoutMs: 25_000 })
  )
);

// ---------------------------------------------------------------------------
// Muro de preguntas
// ---------------------------------------------------------------------------

async function nombreDe(uid: string): Promise<string | null> {
  try {
    return (await getAuth().getUser(uid)).displayName ?? null;
  } catch {
    return null;
  }
}

export async function muroEnClase(
  db: Firestore,
  auth: Auth,
  data: Record<string, unknown>,
  deps: { ahora?: number; nombre?: (uid: string) => Promise<string | null> } = {}
) {
  const ahora = deps.ahora ?? Date.now();
  const nombreDeUid = deps.nombre ?? nombreDe;
  const k = cursoDe(data);
  const accion = data.accion;

  if (accion === 'preguntar') {
    const e = estudiante(auth, k);
    const est = await exigirActivo(db, e.cid, k, e.uid);
    const config = await db.doc(`${rutaCurso(e.cid, k)}/config/muro`).get();
    if (config.get('activo') !== true) throw new HttpsError('failed-precondition', MENSAJES_ERROR_MURO.apagado, { codigo: 'apagado' });
    const t = limpiarTextoMuro(data.texto, MAX_PREGUNTA_MURO);
    if (!t.ok) throw new HttpsError('invalid-argument', MENSAJES_ERROR_MURO[t.error], { codigo: t.error });
    const mias = await db.collection(rutaMuro(e.cid, k)).where('uid', '==', e.uid).get();
    const error = puedePreguntar(mias.docs.map((d) => d.data() as PreguntaMuro), ahora);
    if (error) throw new HttpsError('resource-exhausted', MENSAJES_ERROR_MURO[error], { codigo: error });
    const pregunta: PreguntaMuro = {
      uid: e.uid,
      nombre: nombreEnMuro(est.get('nombre') as string | undefined),
      texto: t.texto,
      estado: 'pendiente',
      creadoAt: ahora,
      respuesta: null,
    };
    const ref = db.collection(rutaMuro(e.cid, k)).doc();
    await ref.set(pregunta);
    return { ok: true, id: ref.id };
  }

  const p = profe(auth);
  const curso = await db.doc(rutaCurso(p.cid, k)).get();
  if (accion === 'configurar') {
    exigirPermiso(curso, p.uid, 'ajustes');
    if (typeof data.activo !== 'boolean') throw new HttpsError('invalid-argument', 'Falta si se enciende o se apaga.');
    await db.doc(`${rutaCurso(p.cid, k)}/config/muro`).set({ activo: data.activo, actualizadoAt: ahora, actualizadoPor: p.uid });
    return { ok: true };
  }
  exigirPermiso(curso, p.uid, 'responderMuro');
  if (!idValido(data.id)) throw new HttpsError('invalid-argument', 'Falta la pregunta.');
  const ref = db.doc(`${rutaMuro(p.cid, k)}/${data.id}`);
  if (!(await ref.get()).exists) throw new HttpsError('not-found', 'Esa pregunta ya no está.');
  if (accion === 'publicar' || accion === 'ocultar') {
    await ref.update({ estado: accion === 'publicar' ? 'publicada' : 'oculta' });
    return { ok: true };
  }
  if (accion === 'responder') {
    const t = limpiarTextoMuro(data.respuesta, MAX_RESPUESTA_MURO);
    if (!t.ok) throw new HttpsError('invalid-argument', t.error === 'larga' ? MENSAJES_ERROR_MURO.respuesta : 'Escribe la respuesta.');
    // Responder la publica: la respuesta es para toda la clase.
    await ref.update({
      respuesta: t.texto,
      respondidaPor: p.uid,
      respondidaPorNombre: (await nombreDeUid(p.uid)) ?? 'Profe',
      respondidaAt: ahora,
      estado: 'publicada',
    });
    return { ok: true };
  }
  if (accion === 'borrar') {
    await ref.delete();
    return { ok: true };
  }
  throw new HttpsError('invalid-argument', 'Acción inválida.');
}

export const muroClase = onCall((r) => muroEnClase(getFirestore(), r.auth, (r.data ?? {}) as Record<string, unknown>));
