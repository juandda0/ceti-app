/**
 * Fase 9 — muro de preguntas de la clase. Se lee de Firestore
 * (`cursos/{k}/muro`, `config/muro`) y se escribe solo por el callable
 * `muroClase`. El estudiante pide las publicadas y las suyas por separado
 * (las reglas no dejan leer el muro entero).
 */
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { callFunction } from '@shared/lib/firebase/functions';
import { muroParaEstudiante, type PreguntaMuro } from '@/functions/src/educadores/dominio';

export type PreguntaConId = PreguntaMuro & { id: string };

function db() {
  const c = getFirebaseClients();
  if (!c?.firestore) throw new Error('Firebase no está configurado.');
  return c.firestore;
}
const muro = (cid: string, k: string) => collection(db(), 'colegios', cid, 'cursos', k, 'muro');
const conId = (d: { id: string; data: () => unknown }) => ({ id: d.id, ...(d.data() as PreguntaMuro) });

export const muroRepository = {
  async activo(cid: string, k: string): Promise<boolean> {
    const s = await getDoc(doc(db(), 'colegios', cid, 'cursos', k, 'config', 'muro'));
    return s.exists() && s.get('activo') === true;
  },
  /** El profe: todo, lo pendiente primero. */
  async todas(cid: string, k: string): Promise<PreguntaConId[]> {
    const s = await getDocs(muro(cid, k));
    const orden = { pendiente: 0, publicada: 1, oculta: 2 } as const;
    return s.docs.map(conId).sort((a, b) => orden[a.estado] - orden[b.estado] || b.creadoAt - a.creadoAt);
  },
  async paraEstudiante(cid: string, k: string, uid: string): Promise<PreguntaConId[]> {
    const [publicadas, mias] = await Promise.all([
      getDocs(query(muro(cid, k), where('estado', '==', 'publicada'))),
      getDocs(query(muro(cid, k), where('uid', '==', uid))),
    ]);
    const todas = new Map<string, PreguntaConId>();
    for (const d of [...publicadas.docs, ...mias.docs]) todas.set(d.id, conId(d));
    return muroParaEstudiante([...todas.values()], uid);
  },
  preguntar: (cursoId: string, texto: string) => callFunction<{ ok: true; id: string }>('muroClase', { cursoId, accion: 'preguntar', texto }),
  configurar: (cursoId: string, activo: boolean) => callFunction<{ ok: true }>('muroClase', { cursoId, accion: 'configurar', activo }),
  moderar: (cursoId: string, id: string, accion: 'publicar' | 'ocultar' | 'borrar') =>
    callFunction<{ ok: true }>('muroClase', { cursoId, accion, id }),
  responder: (cursoId: string, id: string, respuesta: string) =>
    callFunction<{ ok: true }>('muroClase', { cursoId, accion: 'responder', id, respuesta }),
};
