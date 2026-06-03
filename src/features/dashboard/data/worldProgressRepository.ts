import { getDocs, setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import {
  estudianteProgressCollectionRef,
  estudianteProgressDocRef,
  progressGroupByColegioQuery,
} from '@shared/lib/firebase/paths';
import { stripUndefinedValues } from '@shared/lib/firebase/sanitizeForFirestore';
import type { WorldProgress } from '@shared/types/tenancy';

/**
 * Tenant-tree progress: students write their own (gated by firestore.rules to
 * estado=='activo'); teachers/staff read it for the dashboard.
 */
export const worldProgressRepository = {
  async upsert(
    colegioId: string,
    cursoId: string,
    studentId: string,
    worldId: string,
    progress: WorldProgress
  ): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = estudianteProgressDocRef(clients.firestore, colegioId, cursoId, studentId, worldId);
    await setDoc(ref, stripUndefinedValues({ ...progress } as Record<string, unknown>), {
      merge: true,
    });
    return true;
  },

  async getStudentProgress(
    colegioId: string,
    cursoId: string,
    studentId: string
  ): Promise<WorldProgress[]> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return [];
    const snap = await getDocs(
      estudianteProgressCollectionRef(clients.firestore, colegioId, cursoId, studentId)
    );
    return snap.docs.map((d) => d.data() as WorldProgress);
  },

  /** All progress in a colegio (collection-group; rector/coordinador only per rules). */
  async getColegioProgress(colegioId: string): Promise<WorldProgress[]> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return [];
    const snap = await getDocs(progressGroupByColegioQuery(clients.firestore, colegioId));
    return snap.docs.map((d) => d.data() as WorldProgress);
  },
};
