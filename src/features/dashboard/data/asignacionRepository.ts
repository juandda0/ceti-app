import { addDoc, getDocs } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import {
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
 * financiero (RQ-PR14). Staff create; members read. `kind` discriminates.
 */
export const asignacionRepository = {
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
