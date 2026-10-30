import { addDoc, deleteDoc, getDocs, updateDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import {
  asignacionDocRef,
  asignacionesByCursoQuery,
  asignacionesCollectionRef,
  asignacionesDeCursoParaEstudianteQuery,
  asignacionesIndividualesQuery,
} from '@shared/lib/firebase/paths';
import { stripUndefinedValues } from '@shared/lib/firebase/sanitizeForFirestore';
import type { AsignacionAny } from '@shared/types/tenancy';

export type AsignacionWithId = AsignacionAny & { id: string };

function mapAsignaciones(snaps: Awaited<ReturnType<typeof getDocs>>[]): AsignacionWithId[] {
  return snaps.flatMap((snap) =>
    snap.docs.map((item) => ({ id: item.id, ...(item.data() as AsignacionAny) }))
  );
}

/**
 * Assignments: a mundo brief ("complete World X before date Y") or a reto
 * financiero (RQ-PR14). Staff create, move the deadline and delete; members
 * read. `kind` discriminates.
 */
export const asignacionRepository = {
  /** Moves the deadline (rules keep the target and author unchanged). */
  async setDeadline(colegioId: string, id: string, deadline: number): Promise<void> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return;
    await updateDoc(asignacionDocRef(clients.firestore, colegioId, id), { deadline });
  },

  async remove(colegioId: string, id: string): Promise<void> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return;
    await deleteDoc(asignacionDocRef(clients.firestore, colegioId, id));
  },

  async create(colegioId: string, asignacion: AsignacionAny): Promise<boolean> {
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
    return mapAsignaciones([snap]);
  },

  async listForStudent(
    colegioId: string,
    cursoId: string,
    uid: string
  ): Promise<AsignacionWithId[]> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return [];
    const snaps = await Promise.all([
      getDocs(asignacionesDeCursoParaEstudianteQuery(clients.firestore, colegioId, cursoId)),
      getDocs(asignacionesIndividualesQuery(clients.firestore, colegioId, cursoId, uid)),
    ]);
    return mapAsignaciones(snaps);
  },
};
