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
import type { WorldId } from '@features/learning/data/questionBank.types';
import { competenciaForWorld } from '@features/learning/data/competencias';
import { computeMastery, isMastered } from '@features/learning/data/mastery';

export interface BuildWorldProgressInput {
  colegioId: string;
  cursoId: string;
  studentId: string;
  worldId: WorldId;
  /** Correct answers / total questions for this world. */
  correct: number;
  total: number;
  xp: number;
  nivel: number;
  quizScores?: Record<string, number>;
  badges?: string[];
  /** Caller-supplied timestamp (ms). Keeps this function pure/testable. */
  now: number;
}

export function buildWorldProgress(input: BuildWorldProgressInput): WorldProgress {
  const mastery = computeMastery(input.correct, input.total);
  const completed = isMastered(input.correct, input.total);
  return {
    colegioId: input.colegioId,
    cursoId: input.cursoId,
    studentId: input.studentId,
    competencia: competenciaForWorld(input.worldId).id,
    xp: input.xp,
    nivel: input.nivel,
    mastery,
    quizScores: input.quizScores ?? {},
    badges: input.badges ?? [],
    completed,
    ...(completed ? { completedAt: input.now } : {}),
    updatedAt: input.now,
  };
}
