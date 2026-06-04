/**
 * Rule-based adaptive question selection (V3) — NO generative AI / no ML, just a
 * deterministic difficulty ladder. The next question is chosen to match the
 * student's current performance: a short correct streak ramps difficulty up, a
 * miss steps it down. Pure & testable; the LLM/"generative" bank stays a gated
 * V3 item (see CLAUDE.md).
 */
export type Difficulty = 'basic' | 'intermediate' | 'advanced';

const ORDER: Difficulty[] = ['basic', 'intermediate', 'advanced'];

export interface AnswerResult {
  difficulty: Difficulty;
  correct: boolean;
}

function clampIndex(i: number): number {
  return Math.max(0, Math.min(ORDER.length - 1, i));
}

/**
 * Target difficulty from the session's answer history. Starts at 'basic'; two
 * correct in a row bump it up one rung (streak resets), a wrong answer drops it
 * one rung. Bounded to the available rungs.
 */
export function targetDifficulty(results: AnswerResult[]): Difficulty {
  let idx = 0;
  let streak = 0;
  for (const r of results) {
    if (r.correct) {
      streak += 1;
      if (streak >= 2 && idx < ORDER.length - 1) {
        idx += 1;
        streak = 0;
      }
    } else {
      streak = 0;
      idx = clampIndex(idx - 1);
    }
  }
  return ORDER[idx];
}

interface HasDifficulty {
  id: string;
  difficulty?: Difficulty;
}

function rung(d: Difficulty | undefined): number {
  const i = ORDER.indexOf((d ?? 'basic') as Difficulty);
  return i < 0 ? 0 : i;
}

/**
 * Picks the next not-yet-consumed question, preferring the target difficulty and
 * then the nearest available rung (ties → easier first, stable by input order).
 * Returns null when every question has been consumed.
 */
export function selectNextQuestion<T extends HasDifficulty>(
  questions: T[],
  consumed: Set<string>,
  results: AnswerResult[]
): T | null {
  const remaining = questions.filter((q) => !consumed.has(q.id));
  if (remaining.length === 0) return null;
  const ti = rung(targetDifficulty(results));
  let best = remaining[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const q of remaining) {
    const r = rung(q.difficulty);
    // distance to target (primary), then easier-first (secondary).
    const score = Math.abs(r - ti) * 10 + r;
    if (score < bestScore) {
      bestScore = score;
      best = q;
    }
  }
  return best;
}
