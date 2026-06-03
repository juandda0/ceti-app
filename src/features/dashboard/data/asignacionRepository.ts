import { addDoc, getDocs } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { asignacionesByCursoQuery, asignacionesCollectionRef } from '@shared/lib/firebase/paths';
import { stripUndefinedValues } from '@shared/lib/firebase/sanitizeForFirestore';
import type { Asignacion } from '@shared/types/tenancy';

export type AsignacionWithId = Asignacion & { id: string };

/** Simple assignments ("complete World X before date Y"). Staff create; members read. */
export const asignacionRepository = {
  async create(colegioId: string, asignacion: Asignacion): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    await addDoc(
      asignacionesCollectionRef(clients.firestore, colegioId),
      stripUndefinedValues({ ...asignacion } as Record<string, unknown>)
    );
    return true;
  },

  async listByCurso(colegioId: string, cursoId: string): Promise<AsignacionWithId[]> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return [];
    const snap = await getDocs(asignacionesByCursoQuery(clients.firestore, colegioId, cursoId));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Asignacion) }));
  },
};
