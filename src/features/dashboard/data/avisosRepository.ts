/**
 * Fase 5 — avisos de la app (`notificaciones/{uid}/items`). Los escribe el
 * servidor (functions/src/educadores/notificaciones.ts): mensajes del profe para
 * el estudiante y alertas de la clase para el profe. Aquí se leen, se marcan
 * como leídos y se guarda el token de push del celular.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { agregarToken, type Aviso } from '@features/dashboard/data/comunicacion';

export { sinLeer, type Aviso } from '@features/dashboard/data/comunicacion';

const LIMITE = 50;

export const avisosRepository = {
  async mios(uid: string): Promise<Aviso[]> {
    const db = getFirebaseClients()?.firestore;
    if (!db) return [];
    const snap = await getDocs(
      query(
        collection(db, 'notificaciones', uid, 'items'),
        orderBy('creadoAt', 'desc'),
        limit(LIMITE)
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Aviso, 'id'>) }));
  },

  async marcarLeidos(uid: string, ids: readonly string[]): Promise<void> {
    const db = getFirebaseClients()?.firestore;
    if (!db || ids.length === 0) return;
    const ahora = Date.now();
    await Promise.all(
      ids.map((id) => updateDoc(doc(db, 'notificaciones', uid, 'items', id), { leidaAt: ahora }))
    );
  },

  async guardarToken(uid: string, token: string): Promise<void> {
    const db = getFirebaseClients()?.firestore;
    if (!db) return;
    const ref = doc(db, 'notificaciones', uid);
    const snap = await getDoc(ref);
    const actuales = (snap.data()?.expoTokens as string[] | undefined) ?? [];
    if (actuales[0] === token) return;
    await setDoc(ref, { expoTokens: agregarToken(actuales, token), actualizadoAt: Date.now() });
  },
};
