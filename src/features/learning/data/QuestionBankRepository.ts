/**
 * QuestionBankRepository — static quiz assembly (R7, R8, R9).
 *
 * Fetches the three banco documents for a (grado, worldId) cell and assembles
 * exactly 10 items = 4 multiple_choice + 3 true_false + 3 ordenar using a
 * deterministic shuffle seeded from `seedKey` (typically the student's uid).
 *
 * No Math.random. No runtime adaptive logic (R7). Returns [] when any banco
 * is missing or has insufficient items — the screen shows offline state.
 */
import { api, isBackendConfigured, seg } from '@shared/lib/api/client';
import { contentPath, contenidoDocId, cursoPath } from '@shared/lib/api/paths';
import { recordError } from '@shared/lib/analytics/errorReporting';
import { hashStr, stableShuffle } from '@shared/lib/quizUtils';
import type { CourseContentRef } from '@shared/types/tenancy';
import {
  SEEDED_GRADOS,
  type QuizItem,
  type MultipleChoiceItem,
  type TrueFalseItem,
  type OrdenarItem,
  type BancoDoc,
  type Grado,
  type WorldId,
} from './quiz.types';

// ponytail: el banco default solo se sembró para 9–11 (E12). Un curso de grado
// menor cae a 9° para no ver mundos vacíos; upgrade path: sembrar 1–8 o que el
// profesor autore su contenido (copy-on-write por curso).
function seededGrado(grado: Grado): Grado {
  return SEEDED_GRADOS.includes(grado) ? grado : '9';
}

// Required counts per type (R9: 4 + 3 + 3 = 10)
const REQUIRED_MC = 4;
const REQUIRED_VF = 3;
const REQUIRED_ORDENAR = 3;

/**
 * Reads a single banco doc. When `custom` is set (the course overrides this
 * piece, RQ-PR11) it reads the course copy under `cursos/{cursoId}/contenido/*`
 * and falls back to the global default if the copy is missing (stale flag —
 * fail-soft, the student must never hit a broken world). Returns null when the
 * doc doesn't exist or the backend is not reachable (offline).
 */
async function fetchBancoDoc(
  grado: Grado,
  worldId: WorldId,
  tipo: string,
  custom?: { colegioId: string; cursoId: string } | null
): Promise<BancoDoc | null> {
  if (!isBackendConfigured()) return null;
  try {
    if (custom) {
      const doc = await api.getOrNull<BancoDoc>(
        `${cursoPath(custom.colegioId, custom.cursoId)}/contenido/${seg(contenidoDocId.banco(worldId, tipo))}`
      );
      if (doc) return doc;
    }
    // Custom (`cw_*`) worlds have no global default to fall back to.
    if (worldId.startsWith('cw_')) return null;
    return await api.getOrNull<BancoDoc>(contentPath.banco(seededGrado(grado), worldId, tipo));
  } catch (e) {
    recordError(e, 'banco_fetch');
    return null;
  }
}

/**
 * Assembles exactly 10 quiz items for (grado, worldId) deterministically.
 *
 * Assembly contract:
 *   - Reads docs: `${grado}_${worldId}_multiple_choice`, `_true_false`, `_ordenar`.
 *   - Derives a per-type seed from hashStr(`${seedKey}:${tipo}`), so each type
 *     shuffles independently but repeatably for the same student.
 *   - Takes the first REQUIRED_N items from the shuffled list.
 *   - Returns [] if any banco is missing or has fewer items than required.
 */
export const questionBankRepository = {
  async fetchAssembledQuiz(
    grado: Grado,
    worldId: WorldId,
    seedKey: string,
    courseContent?: CourseContentRef | null
  ): Promise<QuizItem[]> {
    // Per-piece override flags (RQ-PR11): a course may override only some types.
    const pin = courseContent
      ? { colegioId: courseContent.colegioId, cursoId: courseContent.cursoId }
      : null;
    const ov = courseContent?.overrides;
    const [mcDoc, vfDoc, ordDoc] = await Promise.all([
      fetchBancoDoc(grado, worldId, 'multiple_choice', ov?.mc ? pin : null),
      fetchBancoDoc(grado, worldId, 'true_false', ov?.vf ? pin : null),
      fetchBancoDoc(grado, worldId, 'ordenar', ov?.ordenar ? pin : null),
    ]);

    // Stamp the discriminator `tipo` onto each item — it lives on the banco doc,
    // not on the items (S5 schema), but the UI renders by item.tipo.
    const mcItems = (mcDoc?.items ?? []).map((it) => ({
      ...it,
      tipo: 'multiple_choice',
    })) as MultipleChoiceItem[];
    const vfItems = (vfDoc?.items ?? []).map((it) => ({
      ...it,
      tipo: 'true_false',
    })) as TrueFalseItem[];
    const ordItems = (ordDoc?.items ?? []).map((it) => ({
      ...it,
      tipo: 'ordenar',
    })) as OrdenarItem[];

    if (
      mcItems.length < REQUIRED_MC ||
      vfItems.length < REQUIRED_VF ||
      ordItems.length < REQUIRED_ORDENAR
    ) {
      return [];
    }

    // Deterministic per-type seeds (no Math.random)
    const mcSeed = hashStr(`${seedKey}:multiple_choice`);
    const vfSeed = hashStr(`${seedKey}:true_false`);
    const ordSeed = hashStr(`${seedKey}:ordenar`);

    const selected: QuizItem[] = [
      ...stableShuffle(mcItems, mcSeed).slice(0, REQUIRED_MC),
      ...stableShuffle(vfItems, vfSeed).slice(0, REQUIRED_VF),
      ...stableShuffle(ordItems, ordSeed).slice(0, REQUIRED_ORDENAR),
    ];

    return selected;
  },
};
