/**
 * Fase 8 — grupos de la clase (`cursos/{k}/config/grupos`, ver
 * functions/src/educadores/dominio/grupos.ts). Los edita cualquier profe de la
 * clase; los estudiantes activos los leen (ven el nombre de su grupo).
 */
import { deleteDoc, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import type { Grupo } from '@/functions/src/educadores/dominio';

function db() {
  const c = getFirebaseClients();
  if (!c?.firestore) throw new Error('Sin conexión con Firebase.');
  return c.firestore;
}

const ref = (cid: string, k: string) => doc(db(), 'colegios', cid, 'cursos', k, 'config', 'grupos');

const leer = (d: Record<string, unknown> | undefined): Grupo[] =>
  Array.isArray(d?.grupos) ? (d.grupos as Grupo[]).filter((g) => g && Array.isArray(g.uids)) : [];

export const gruposRepository = {
  async get(cid: string, k: string): Promise<Grupo[]> {
    const s = await getDoc(ref(cid, k));
    return s.exists() ? leer(s.data()) : [];
  },

  escuchar(cid: string, k: string, cb: (g: Grupo[]) => void): () => void {
    return onSnapshot(
      ref(cid, k),
      (s) => cb(s.exists() ? leer(s.data()) : []),
      () => cb([])
    );
  },

  async guardar(cid: string, k: string, grupos: Grupo[], autor: string) {
    if (grupos.length === 0) return deleteDoc(ref(cid, k));
    await setDoc(ref(cid, k), {
      grupos: grupos.map((g) => ({ id: g.id, nombre: g.nombre.trim(), color: g.color, uids: g.uids })),
      actualizadoAt: Date.now(),
      actualizadoPor: autor,
    });
  },
};
