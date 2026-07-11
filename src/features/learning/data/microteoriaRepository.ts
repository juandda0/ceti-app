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
import {
  contenidoDocId,
  cursoContenidoDocRef,
  microteoriaDocRef,
} from '@shared/lib/firebase/paths';
import type { MicroteoriaBank } from './content.types';
import type { Grado, WorldId } from './quiz.types';

export const microteoriaRepository = {
  /**
   * `custom` (RQ-PR11): the course overrides its theory — read the course copy
   * first and fall back to the global default if the copy is missing.
   */
  async fetch(
    grado: Grado,
    worldId: WorldId,
    custom?: { colegioId: string; cursoId: string } | null
  ): Promise<MicroteoriaBank | null> {
    const clients = getFirebaseClients();
    if (!clients) return null;
    try {
      if (custom) {
        const customSnap = await getDoc(
          cursoContenidoDocRef(
            clients.firestore,
            custom.colegioId,
            custom.cursoId,
            contenidoDocId.microteoria(worldId)
          )
        );
        if (customSnap.exists()) return customSnap.data() as MicroteoriaBank;
      }
      const snap = await getDoc(microteoriaDocRef(clients.firestore, grado, worldId));
      if (!snap.exists()) return null;
      return snap.data() as MicroteoriaBank;
    } catch {
      return null;
    }
  },
};
