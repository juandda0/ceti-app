/**
 * Deterministic quiz utilities — used by QuestionBankRepository to assemble
 * the fixed 10-item set per student (R7: no runtime adaptive selection).
 *
 * Both helpers are pure and testable. Math.random is never used.
 */

/**
 * Stable integer hash of a string (djb2 variant). Deterministic across runs.
 * Used as the initial seed for stableShuffle.
 */
export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Fisher-Yates shuffle with a linear-congruential PRNG seeded from `seed`.
 * Deterministic: same (arr, seed) always produces the same permutation.
 * Does NOT use Math.random.
 */
export function stableShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    const j = Math.abs(s) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
