/**
 * eligeCaminoRepository — fetches a situational EligeCamino bank from Firestore.
 *
 * Collection: `bancosEligeCamino/{grado}_{worldId}`
 * R7: no runtime adaptive selection; R8: read-only from runtime client.
 * R5: the student's choice is NOT persisted per-student.
 *
 * Returns null when:
 *  - Firebase is not configured (demo/offline mode).
 *  - The document does not exist for the given (grado, worldId).
 *  - A network error occurs.
 */
import { getDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import {
  contenidoDocId,
  cursoContenidoDocRef,
  eligeCaminoDocRef,
} from '@shared/lib/firebase/paths';
import type { EligeCaminoBank } from './content.types';
import type { Grado, WorldId } from './quiz.types';

export const eligeCaminoRepository = {
  /**
   * `custom` (RQ-PR11): the course overrides its EligeCamino bank — read the
   * course copy first, falling back to the global default if it is missing.
   */
  async fetch(
    grado: Grado,
    worldId: WorldId,
    custom?: { colegioId: string; cursoId: string } | null
  ): Promise<EligeCaminoBank | null> {
    const clients = getFirebaseClients();
    if (!clients) return null;
    try {
      if (custom) {
        const customSnap = await getDoc(
          cursoContenidoDocRef(
            clients.firestore,
            custom.colegioId,
            custom.cursoId,
            contenidoDocId.eligeCamino(worldId)
          )
        );
        if (customSnap.exists()) return customSnap.data() as EligeCaminoBank;
      }
      const snap = await getDoc(eligeCaminoDocRef(clients.firestore, grado, worldId));
      if (!snap.exists()) return null;
      return snap.data() as EligeCaminoBank;
    } catch {
      return null;
    }
  },
};
