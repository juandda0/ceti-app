/**
 * microteoriaRepository — fetches a micro-theory card bank from Firestore.
 *
 * Collection: `microteoria/{grado}_{worldId}`
 * R7: static content only; R8: read-only from runtime client.
 *
 * Returns null when:
 *  - Firebase is not configured (demo/offline mode).
 *  - The document does not exist for the given (grado, worldId).
 *  - A network error occurs.
 */
import { getDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { microteoriaDocRef } from '@shared/lib/firebase/paths';
import type { MicroteoriaBank } from './content.types';
import type { Grado, WorldId } from './quiz.types';

export const microteoriaRepository = {
  async fetch(grado: Grado, worldId: WorldId): Promise<MicroteoriaBank | null> {
    const clients = getFirebaseClients();
    if (!clients) return null;
    try {
      const snap = await getDoc(microteoriaDocRef(clients.firestore, grado, worldId));
      if (!snap.exists()) return null;
      return snap.data() as MicroteoriaBank;
    } catch {
      return null;
    }
  },
};
