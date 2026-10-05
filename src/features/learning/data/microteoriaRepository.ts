/**
 * microteoriaRepository — fetches a micro-theory card bank from the backend.
 *
 * Id: `{grado}_{worldId}`
 * R7: static content only; R8: read-only from runtime client.
 *
 * Returns null when:
 *  - The backend is not configured (offline mode).
 *  - The document does not exist for the given (grado, worldId).
 *  - A network error occurs.
 */
import { api, isBackendConfigured, seg } from '@shared/lib/api/client';
import { contentPath, contenidoDocId, cursoPath } from '@shared/lib/api/paths';
import { recordError } from '@shared/lib/analytics/errorReporting';
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
    if (!isBackendConfigured()) return null;
    try {
      if (custom) {
        const doc = await api.getOrNull<MicroteoriaBank>(
          `${cursoPath(custom.colegioId, custom.cursoId)}/contenido/${seg(contenidoDocId.microteoria(worldId))}`
        );
        if (doc) return doc;
      }
      return await api.getOrNull<MicroteoriaBank>(contentPath.microteoria(grado, worldId));
    } catch (e) {
      recordError(e, 'microteoria_fetch');
      return null;
    }
  },
};
