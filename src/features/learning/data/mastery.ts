/**
 * Mastery computation for worlds/competencies. Mastery is achievement-based
 * (share of correct answers), never time-based — badges and reports must reward
 * real mastery, not minutes spent (see ceti-invariants.mdc).
 */

/** Minimum mastery (0..1) to consider a competency mastered. */
export const MASTERY_THRESHOLD = 0.8;

/** Mastery as correct/total, clamped to 0..1. Returns 0 when there are no questions. */
export function computeMastery(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, correct / total));
}

/** Whether a world's quiz result meets the mastery threshold. */
export function isMastered(correct: number, total: number): boolean {
  return total > 0 && computeMastery(correct, total) >= MASTERY_THRESHOLD;
}

/** Mastery as an integer percentage (0..100) for display/reports. */
export function masteryPercent(correct: number, total: number): number {
  return Math.round(computeMastery(correct, total) * 100);
}
