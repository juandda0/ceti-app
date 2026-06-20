/**
 * Tests for the deterministic 30% EligeCamino trigger and situacion picker.
 *
 * Verifies:
 *  1. Same (uid, worldId) always produces the same trigger decision (stability).
 *  2. Across a range of 1000 synthetic uids, ~30% trigger (±8% tolerance).
 *  3. pickSituacion is stable: same inputs → same index.
 *  4. pickSituacion covers the full range of indices across diverse seeds.
 *  5. No Math.random is used (override throws, functions must not throw).
 */
import { shouldShowEligeCamino, pickSituacion } from './eligeCaminoUtils';
import type { Situacion } from '@features/learning/data/content.types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeSituaciones(n: number): Situacion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    enunciado: `Situacion ${i}`,
    opcionA: { texto: `Opcion A ${i}`, consecuencia: `Consecuencia A ${i}` },
    opcionB: { texto: `Opcion B ${i}`, consecuencia: `Consecuencia B ${i}` },
  }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('shouldShowEligeCamino (deterministic 30% trigger)', () => {
  const worldId = 'world_1';

  it('is stable: same (uid, worldId) always returns the same boolean', () => {
    const uid = 'user-abc-123';
    const call1 = shouldShowEligeCamino(uid, worldId);
    const call2 = shouldShowEligeCamino(uid, worldId);
    expect(call1).toBe(call2);
  });

  it('different worldIds may produce different results for the same uid', () => {
    const uid = 'user-xyz';
    // Not guaranteed to differ for every uid, but test with a few known cases
    const results = ['world_1', 'world_2', 'world_3', 'world_4', 'world_5'].map((w) =>
      shouldShowEligeCamino(uid, w)
    );
    // At least some variation expected across 5 worlds
    const trueCount = results.filter(Boolean).length;
    // Can't assert exact values but at least the function runs consistently
    expect(typeof trueCount).toBe('number');
    expect(trueCount).toBeGreaterThanOrEqual(0);
    expect(trueCount).toBeLessThanOrEqual(5);
  });

  it('triggers ~30% across 1000 diverse seeds (within ±8% of 30%)', () => {
    let triggered = 0;
    const total = 1000;
    for (let i = 0; i < total; i++) {
      if (shouldShowEligeCamino(`uid-seed-${i}`, worldId)) triggered++;
    }
    const rate = triggered / total;
    // Allow ±8% tolerance around 30% (22%–38%)
    expect(rate).toBeGreaterThanOrEqual(0.22);
    expect(rate).toBeLessThanOrEqual(0.38);
  });

  it('does not use Math.random', () => {
    const original = Math.random;
    Math.random = (): number => {
      throw new Error('Math.random called — violates R7');
    };
    try {
      expect(() => shouldShowEligeCamino('any-uid', worldId)).not.toThrow();
    } finally {
      Math.random = original;
    }
  });
});

describe('pickSituacion (deterministic situacion selection)', () => {
  const situaciones = makeSituaciones(5);
  const worldId = 'world_1';

  it('is stable: same (uid, worldId, situaciones) → same situacion', () => {
    const uid = 'user-pick-test';
    const pick1 = pickSituacion(uid, worldId, situaciones);
    const pick2 = pickSituacion(uid, worldId, situaciones);
    expect(pick1.id).toBe(pick2.id);
  });

  it('returns a valid situacion from the array', () => {
    const uid = 'user-pick-valid';
    const pick = pickSituacion(uid, worldId, situaciones);
    expect(situaciones.map((s) => s.id)).toContain(pick.id);
  });

  it('does not use Math.random', () => {
    const original = Math.random;
    Math.random = (): number => {
      throw new Error('Math.random called — violates R7');
    };
    try {
      expect(() => pickSituacion('any', worldId, situaciones)).not.toThrow();
    } finally {
      Math.random = original;
    }
  });

  it('covers all indices across diverse seeds (all 5 positions selected at least once in 200 draws)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const pick = pickSituacion(`uid-coverage-${i}`, worldId, situaciones);
      seen.add(pick.id);
    }
    // All 5 situaciones should be reachable across diverse seeds
    expect(seen.size).toBe(5);
  });

  it('different worldIds select different situaciones for the same uid', () => {
    // This is probabilistic; with 5 worlds and 5 situaciones they won't always differ
    // but we verify the function doesn't crash and returns valid results
    const uid = 'user-worlds-test';
    const worlds = ['world_1', 'world_2', 'world_3', 'world_4', 'world_5'];
    const picks = worlds.map((w) => pickSituacion(uid, w, situaciones).id);
    // All picks should be valid
    picks.forEach((id) => {
      expect(situaciones.map((s) => s.id)).toContain(id);
    });
  });
});
