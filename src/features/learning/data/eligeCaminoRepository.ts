/**
 * eligeCaminoRepository — fetches a situational EligeCamino bank from the backend.
 *
 * Id: `{grado}_{worldId}`
 * R7: no runtime adaptive selection; R8: read-only from runtime client.
 * R5: the student's choice is NOT persisted per-student.
 *
 * Returns null when:
 *  - The backend is not configured (offline mode).
 *  - The document does not exist for the given (grado, worldId).
 *  - A network error occurs.
 */
import { api, isBackendConfigured, seg } from '@shared/lib/api/client';
import { contentPath, contenidoDocId, cursoPath } from '@shared/lib/api/paths';
import { recordError } from '@shared/lib/analytics/errorReporting';
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
    if (!isBackendConfigured()) return null;
    try {
      if (custom) {
        const doc = await api.getOrNull<EligeCaminoBank>(
          `${cursoPath(custom.colegioId, custom.cursoId)}/contenido/${seg(contenidoDocId.eligeCamino(worldId))}`
        );
        if (doc) return doc;
      }
      return await api.getOrNull<EligeCaminoBank>(contentPath.eligeCamino(grado, worldId));
    } catch (e) {
      recordError(e, 'eligeCamino_fetch');
      return null;
    }
  },
};
