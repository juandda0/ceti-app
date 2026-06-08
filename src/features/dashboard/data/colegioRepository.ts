import { getDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { colegioDocRef } from '@shared/lib/firebase/paths';
import type { Colegio } from '@shared/types/tenancy';

/** Reads a colegio's identity (nombre/logo) — used for headers and certificates. */
export const colegioRepository = {
  async getColegio(colegioId: string): Promise<Colegio | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const snap = await getDoc(colegioDocRef(clients.firestore, colegioId));
    return snap.exists() ? (snap.data() as Colegio) : null;
  },
};
