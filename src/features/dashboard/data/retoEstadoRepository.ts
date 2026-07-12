import { getDocs, setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import {
  estudianteRetoEstadoDocRef,
  estudianteRetosCollectionRef,
} from '@shared/lib/firebase/paths';
import { stripUndefinedValues } from '@shared/lib/firebase/sanitizeForFirestore';
import type { RetoEstadoDoc } from '@shared/types/tenancy';

export const retoEstadoRepository = {
  async upsertEstado(
    colegioId: string,
    cursoId: string,
    uid: string,
    retoId: string,
    estadoDoc: RetoEstadoDoc
  ): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = estudianteRetoEstadoDocRef(clients.firestore, colegioId, cursoId, uid, retoId);
    await setDoc(ref, stripUndefinedValues({ ...estadoDoc } as Record<string, unknown>), {
      merge: true,
    });
    return true;
  },

  async listByEstudiante(
    colegioId: string,
    cursoId: string,
    uid: string
  ): Promise<RetoEstadoDoc[]> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return [];
    const snap = await getDocs(
      estudianteRetosCollectionRef(clients.firestore, colegioId, cursoId, uid)
    );
    return snap.docs.map((d) => d.data() as RetoEstadoDoc);
  },
};
