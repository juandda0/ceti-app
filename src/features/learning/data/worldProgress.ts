/**
 * Builds a tenant-tree WorldProgress doc from a world's quiz result. Pure (takes
 * `now` as input) so it is testable and deterministic. The output shape matches
 * the type/range checks in firestore.rules (denormalized keys, mastery 0..1,
 * numbers, bools), so it is safe to write via the world-progress repository (F6).
 *
 * `competencia` is taken from the world↔CONPES mapping — this is how the teacher
 * report ends up keyed by competency.
 */
import type { WorldProgress } from '@shared/types/tenancy';
import type { WorldId } from '@features/learning/data/quiz.types';
import {
  COMPETENCIA_PERSONALIZADA,
  competenciaForWorld,
} from '@features/learning/data/competencias';
import { computeMastery, isMastered } from '@features/learning/data/mastery';

export interface BuildWorldProgressInput {
  colegioId: string;
  cursoId: string;
  uid: string;
  worldId: WorldId;
  /** Correct answers / total questions for this world. */
  correct: number;
  total: number;
  quizScores?: Record<string, number>;
  /**
   * Explicit competency (custom worlds, RQ-PR12 CA2): the professor-assigned
   * CONPES id. Absent → the default world↔CONPES mapping, or 'personalizada'
   * for a custom world without an assignment (progress-only in reports).
   */
  competencia?: string;
  /** Caller-supplied timestamp (ms). Keeps this function pure/testable. */
  now: number;
}

export function buildWorldProgress(input: BuildWorldProgressInput): WorldProgress {
  const mastery = computeMastery(input.correct, input.total);
  const completed = isMastered(input.correct, input.total);
  return {
    colegioId: input.colegioId,
    cursoId: input.cursoId,
    uid: input.uid,
    competencia:
      input.competencia ?? competenciaForWorld(input.worldId)?.id ?? COMPETENCIA_PERSONALIZADA,
    mastery,
    quizScores: input.quizScores ?? {},
    completed,
    ...(completed ? { completedAt: input.now } : {}),
    updatedAt: input.now,
  };
}
