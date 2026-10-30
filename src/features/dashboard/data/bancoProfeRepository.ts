/**
 * Mi banco de preguntas (Fase 4): las preguntas que el profe guarda para
 * reutilizarlas en cualquier clase o mundo, con etiquetas de tema. Vive en
 * `bancosProfe/{uid}/preguntas/{id}` y solo lo lee y escribe su dueño.
 */
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { stripUndefinedValues } from '@shared/lib/firebase/sanitizeForFirestore';
import type { QuizItem } from '@features/learning/data/quiz.types';
import { limpiarTemas, type PreguntaGuardada } from '@features/dashboard/data/bancoProfe';

export type { PreguntaGuardada } from '@features/dashboard/data/bancoProfe';

function coleccion(uid: string) {
  const clients = getFirebaseClients();
  return clients?.firestore ? collection(clients.firestore, 'bancosProfe', uid, 'preguntas') : null;
}

export const bancoProfeRepository = {
  async listar(uid: string): Promise<PreguntaGuardada[]> {
    const col = coleccion(uid);
    if (!col) return [];
    const snap = await getDocs(col);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<PreguntaGuardada, 'id'>), id: d.id }));
  },

  async guardar(
    uid: string,
    item: QuizItem,
    temas: string[],
    origen: PreguntaGuardada['origen']
  ): Promise<string | null> {
    const col = coleccion(uid);
    if (!col) return null;
    const ref = doc(col);
    await setDoc(
      ref,
      stripUndefinedValues({
        item: { ...item } as Record<string, unknown>,
        tipo: item.tipo,
        temas: limpiarTemas(temas),
        origen,
        creadoAt: Date.now(),
      } as Record<string, unknown>)
    );
    return ref.id;
  },

  async borrar(uid: string, id: string): Promise<void> {
    const col = coleccion(uid);
    if (!col) return;
    await deleteDoc(doc(col, id));
  },
};
