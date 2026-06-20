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
import { getDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { bancoDocRef } from '@shared/lib/firebase/paths';
import { hashStr, stableShuffle } from '@shared/lib/quizUtils';
import type {
  QuizItem,
  MultipleChoiceItem,
  TrueFalseItem,
  OrdenarItem,
  BancoDoc,
  Grado,
  WorldId,
} from './quiz.types';

// Required counts per type (R9: 4 + 3 + 3 = 10)
const REQUIRED_MC = 4;
const REQUIRED_VF = 3;
const REQUIRED_ORDENAR = 3;

/**
 * Reads a single banco doc. Returns null when the doc doesn't exist or
 * Firebase is not available (offline / demo mode).
 */
async function fetchBancoDoc(
  grado: Grado,
  worldId: WorldId,
  tipo: string
): Promise<BancoDoc | null> {
  const clients = getFirebaseClients();
  if (!clients) return null;
  try {
    const snap = await getDoc(bancoDocRef(clients.firestore, grado, worldId, tipo));
    if (!snap.exists()) return null;
    return snap.data() as BancoDoc;
  } catch {
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
  async fetchAssembledQuiz(grado: Grado, worldId: WorldId, seedKey: string): Promise<QuizItem[]> {
    const [mcDoc, vfDoc, ordDoc] = await Promise.all([
      fetchBancoDoc(grado, worldId, 'multiple_choice'),
      fetchBancoDoc(grado, worldId, 'true_false'),
      fetchBancoDoc(grado, worldId, 'ordenar'),
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
