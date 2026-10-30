/**
 * Fase 8a — clase en vivo, lado cliente (ver functions/src/educadores/dominio/claseVivo.ts).
 * El profe y los estudiantes escuchan `cursos/{k}/vivo/actual` en tiempo real;
 * el profe también las respuestas de la pregunta abierta y quién entró. Todo
 * cambio de estado pasa por el callable `operarClaseVivo`.
 */
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  getDocs,
  limit,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { callFunction } from '@shared/lib/firebase/functions';
import type { PreguntaVivo, SesionVivo } from '@/functions/src/educadores/dominio';

function db() {
  const c = getFirebaseClients();
  if (!c?.firestore) throw new Error('Sin conexión con Firebase.');
  return c.firestore;
}

const base = (cid: string, k: string) => ['colegios', cid, 'cursos', k, 'vivo', 'actual'] as const;

export interface ResumenSesionVivo {
  id: string;
  worldId: string;
  titulo: string;
  preguntas: number;
  participantes: number;
  pctAciertos: number | null;
  creadoAt: number;
}

export const vivoRepository = {
  /** La sesión en curso (null si no hay). Devuelve la función para dejar de escuchar. */
  escuchar(cid: string, k: string, cb: (s: SesionVivo | null) => void, onError?: () => void): () => void {
    const [c, ...resto] = base(cid, k);
    return onSnapshot(
      doc(db(), c, ...resto),
      (s) => cb(s.exists() ? (s.data() as SesionVivo) : null),
      () => onError?.()
    );
  },

  /** El profe: cuántos respondieron la pregunta `n`. */
  escucharRespuestas(cid: string, k: string, n: number, cb: (uids: string[]) => void): () => void {
    const [c, ...resto] = base(cid, k);
    return onSnapshot(query(collection(db(), c, ...resto, 'respuestas'), where('n', '==', n)), (s) =>
      cb(s.docs.map((d) => d.get('uid') as string))
    );
  },

  /** El profe: quién entró a la sesión `sesion`. */
  escucharPresentes(cid: string, k: string, sesion: string, cb: (uids: string[]) => void): () => void {
    const [c, ...resto] = base(cid, k);
    return onSnapshot(query(collection(db(), c, ...resto, 'presentes'), where('sesion', '==', sesion)), (s) =>
      cb(s.docs.map((d) => d.id))
    );
  },

  /** El estudiante: marca que entró. */
  async entrar(cid: string, k: string, uid: string, sesion: string) {
    const [c, ...resto] = base(cid, k);
    await setDoc(doc(db(), c, ...resto, 'presentes', uid), { sesion, entradaAt: Date.now() });
  },

  /** El estudiante: responde la pregunta `n` (una vez; la hora la pone el servidor). */
  async responder(cid: string, k: string, uid: string, sesion: string, n: number, r: number) {
    const [c, ...resto] = base(cid, k);
    await setDoc(doc(db(), c, ...resto, 'respuestas', `${n}_${uid}`), {
      uid,
      n,
      r,
      sesion,
      creadoAt: serverTimestamp(),
    });
  },

  crear: (cursoId: string, p: { worldId: string; titulo: string; segundos: number; preguntas: PreguntaVivo[] }) =>
    callFunction<{ ok: true; sesion: SesionVivo }>('operarClaseVivo', { cursoId, accion: 'crear', ...p }),

  operar: (cursoId: string, accion: 'siguiente' | 'revelar' | 'terminar' | 'cerrar') =>
    callFunction<{ ok: true; sesion?: SesionVivo }>('operarClaseVivo', { cursoId, accion }),

  /** El profe: las últimas clases en vivo de la clase (sin nombres). */
  async historial(cid: string, k: string): Promise<ResumenSesionVivo[]> {
    const s = await getDocs(
      query(collection(db(), 'colegios', cid, 'cursos', k, 'sesionesVivo'), orderBy('creadoAt', 'desc'), limit(10))
    );
    return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ResumenSesionVivo, 'id'>) }));
  },
};
