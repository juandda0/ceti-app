/**
 * Fase 9 — tareas abiertas con rúbrica. Se leen de Firestore
 * (`cursos/{k}/tareasAbiertas`) y se escriben solo por callables
 * (functions/src/educadores/claseAbierta.ts).
 */
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { callFunction } from '@shared/lib/firebase/functions';
import type { Calificacion, Entrega, SugerenciaCriterio, TareaAbierta } from '@/functions/src/educadores/dominio';

export type TareaConId = TareaAbierta & { id: string };
export type EntregaGuardada = Entrega & { calificada?: boolean };

function db() {
  const c = getFirebaseClients();
  if (!c?.firestore) throw new Error('Firebase no está configurado.');
  return c.firestore;
}

const tareas = (cid: string, k: string) => collection(db(), 'colegios', cid, 'cursos', k, 'tareasAbiertas');

export type TareaEditable = Pick<TareaAbierta, 'titulo' | 'consigna' | 'rubrica' | 'deadline' | 'worldId'>;

export const tareasAbiertasRepository = {
  async listar(cid: string, k: string): Promise<TareaConId[]> {
    const s = await getDocs(query(tareas(cid, k), orderBy('creadaAt', 'desc')));
    return s.docs.map((d) => ({ id: d.id, ...(d.data() as TareaAbierta) }));
  },
  async una(cid: string, k: string, id: string): Promise<TareaConId | null> {
    const s = await getDoc(doc(tareas(cid, k), id));
    return s.exists() ? { id: s.id, ...(s.data() as TareaAbierta) } : null;
  },
  /** El profe: todas las entregas de una tarea. */
  async entregas(cid: string, k: string, id: string): Promise<EntregaGuardada[]> {
    const s = await getDocs(collection(doc(tareas(cid, k), id), 'entregas'));
    return s.docs.map((d) => d.data() as EntregaGuardada);
  },
  /** El estudiante: su entrega (o null). */
  async miEntrega(cid: string, k: string, id: string, uid: string): Promise<EntregaGuardada | null> {
    const s = await getDoc(doc(collection(doc(tareas(cid, k), id), 'entregas'), uid));
    return s.exists() ? (s.data() as EntregaGuardada) : null;
  },
  crear: (cursoId: string, tarea: TareaEditable) =>
    callFunction<{ ok: true; id: string }>('gestionarTareaAbierta', { cursoId, accion: 'crear', tarea }),
  editar: (cursoId: string, tareaId: string, tarea: TareaEditable) =>
    callFunction<{ ok: true; id: string; rubricaFija?: boolean }>('gestionarTareaAbierta', { cursoId, accion: 'editar', tareaId, tarea }),
  estado: (cursoId: string, tareaId: string, accion: 'cerrar' | 'abrir' | 'borrar') =>
    callFunction<{ ok: true }>('gestionarTareaAbierta', { cursoId, accion, tareaId }),
  entregar: (cursoId: string, tareaId: string, texto: string) =>
    callFunction<{ ok: true }>('entregarTareaAbierta', { cursoId, tareaId, texto }),
  calificar: (cursoId: string, tareaId: string, uid: string, niveles: (number | null)[], comentario: string) =>
    callFunction<{ ok: true; calificacion: Calificacion }>('calificarEntrega', { cursoId, tareaId, uid, niveles, comentario }),
  sugerir: (cursoId: string, tareaId: string, uid: string) =>
    callFunction<{ sugerencia: SugerenciaCriterio[] }>('sugerirCalificacion', { cursoId, tareaId, uid }),
};
