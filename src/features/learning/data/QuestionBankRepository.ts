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
import { bancoDocRef, contenidoDocId, cursoContenidoDocRef } from '@shared/lib/firebase/paths';
import { hashStr, stableShuffle } from '@shared/lib/quizUtils';
import type { CourseContentRef } from '@shared/types/tenancy';
import type { PoolMundo } from '@features/orbita/domain/niveles';
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
 * doc doesn't exist or Firebase is not available (offline / demo mode).
 */
async function fetchBancoDoc(
  grado: Grado,
  worldId: WorldId,
  tipo: string,
  custom?: { colegioId: string; cursoId: string } | null
): Promise<BancoDoc | null> {
  const clients = getFirebaseClients();
  if (!clients) return null;
  try {
    if (custom) {
      const customSnap = await getDoc(
        cursoContenidoDocRef(
          clients.firestore,
          custom.colegioId,
          custom.cursoId,
          contenidoDocId.banco(worldId, tipo)
        )
      );
      if (customSnap.exists()) return customSnap.data() as BancoDoc;
    }
    // Custom (`cw_*`) worlds have no global default to fall back to.
    if (worldId.startsWith('cw_')) return null;
    const snap = await getDoc(bancoDocRef(clients.firestore, seededGrado(grado), worldId, tipo));
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
/**
 * Todo el banco de un mundo, por tipo (para armar los niveles del mapa). null si
 * falta algún banco o no alcanza para el jefe (4 + 3 + 3).
 */
async function fetchPool(
  grado: Grado,
  worldId: WorldId,
  courseContent?: CourseContentRef | null
): Promise<PoolMundo | null> {
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
  const pool: PoolMundo = {
    mc: (mcDoc?.items ?? []).map((it) => ({ ...it, tipo: 'multiple_choice' })) as MultipleChoiceItem[],
    vf: (vfDoc?.items ?? []).map((it) => ({ ...it, tipo: 'true_false' })) as TrueFalseItem[],
    ordenar: (ordDoc?.items ?? []).map((it) => ({ ...it, tipo: 'ordenar' })) as OrdenarItem[],
  };
  if (
    pool.mc.length < REQUIRED_MC ||
    pool.vf.length < REQUIRED_VF ||
    pool.ordenar.length < REQUIRED_ORDENAR
  ) {
    return null;
  }
  return pool;
}

export const questionBankRepository = {
  fetchPool,

  async fetchAssembledQuiz(
    grado: Grado,
    worldId: WorldId,
    seedKey: string,
    courseContent?: CourseContentRef | null
  ): Promise<QuizItem[]> {
    const pool = await fetchPool(grado, worldId, courseContent);
    if (!pool) return [];

    // Deterministic per-type seeds (no Math.random)
    const mcSeed = hashStr(`${seedKey}:multiple_choice`);
    const vfSeed = hashStr(`${seedKey}:true_false`);
    const ordSeed = hashStr(`${seedKey}:ordenar`);

    const selected: QuizItem[] = [
      ...stableShuffle(pool.mc, mcSeed).slice(0, REQUIRED_MC),
      ...stableShuffle(pool.vf, vfSeed).slice(0, REQUIRED_VF),
      ...stableShuffle(pool.ordenar, ordSeed).slice(0, REQUIRED_ORDENAR),
    ];

    return selected;
  },
};
