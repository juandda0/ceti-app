/**
 * Tests for QuestionBankRepository.fetchAssembledQuiz.
 *
 * Verifies:
 *  1. Returns exactly 10 items = 4 MC + 3 VF + 3 ordenar.
 *  2. Two calls with the same seedKey return the SAME set and order (determinism / anti-R7).
 *  3. Two calls with DIFFERENT seedKeys may return different subsets.
 *  4. Returns [] when any banco has fewer items than required.
 *  5. Returns [] when any banco is missing (404 → null from the API).
 */
import { jest } from '@jest/globals';
import type {
  MultipleChoiceItem,
  TrueFalseItem,
  OrdenarItem,
  BancoDoc,
  QuizItem,
} from './quiz.types';

// ── Item factories ────────────────────────────────────────────────────────────

function makeMCItems(n: number): MultipleChoiceItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `mc-${i}`,
    tipo: 'multiple_choice' as const,
    enunciado: `MC question ${i}`,
    opciones: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    competencia: 'ahorro',
    dificultad: 1,
  }));
}

function makeVFItems(n: number): TrueFalseItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `vf-${i}`,
    tipo: 'true_false' as const,
    enunciado: `VF statement ${i}`,
    respuesta: true,
    competencia: 'ahorro',
    dificultad: 1,
  }));
}

function makeOrdenarItems(n: number): OrdenarItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `ord-${i}`,
    tipo: 'ordenar' as const,
    enunciado: `Order these ${i}`,
    elementos: ['step 1', 'step 2', 'step 3'],
    ordenCanonico: [0, 1, 2],
    competencia: 'ahorro',
    dificultad: 1,
  }));
}

function makeBancoDoc(tipo: BancoDoc['tipo'], items: BancoDoc['items']): BancoDoc {
  return {
    bancoId: `9_world_1_${tipo}`,
    grado: '9',
    worldId: 'world_1',
    tipo,
    version: 1,
    generadoPor: 'test',
    pendiente_validacion_docente: false,
    // Real banco items carry NO `tipo` (it lives on the doc, S5 schema).
    // Strip it so the test proves fetchAssembledQuiz stamps the discriminator.
    items: items.map((it) => {
      const { tipo: _omit, ...rest } = it as QuizItem & { tipo: string };
      return rest;
    }) as unknown as BancoDoc['items'],
  };
}

// ── Helper: mock the API given per-type docs ──────────────────────────────────

function makeGetOrNull(mcDoc: BancoDoc | null, vfDoc: BancoDoc | null, ordDoc: BancoDoc | null) {
  return async (path: string): Promise<BancoDoc | null> => {
    // path: `/api/content/bancos/${grado}_${worldId}_${tipo}`
    if (path.endsWith('_multiple_choice')) return mcDoc;
    if (path.endsWith('_true_false')) return vfDoc;
    if (path.endsWith('_ordenar')) return ordDoc;
    return null;
  };
}

/**
 * Mocks the API client and imports a fresh copy of QuestionBankRepository.
 * Must be called AFTER jest.resetModules() in each test.
 */
async function setupAndImport(
  mcDoc: BancoDoc | null,
  vfDoc: BancoDoc | null,
  ordDoc: BancoDoc | null
) {
  jest.doMock('@shared/lib/api/client', () => ({
    api: { getOrNull: jest.fn(makeGetOrNull(mcDoc, vfDoc, ordDoc)) },
    isBackendConfigured: () => true,
    seg: encodeURIComponent,
  }));

  const { questionBankRepository } = await import('./QuestionBankRepository');
  return questionBankRepository;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('QuestionBankRepository.fetchAssembledQuiz', () => {
  const GRADO = '9' as const;
  const WORLD_ID = 'world_1' as const;

  beforeEach(() => {
    jest.resetModules();
  });

  it('returns exactly 10 items (4 MC + 3 VF + 3 ordenar) with sufficient bancos', async () => {
    const repo = await setupAndImport(
      makeBancoDoc('multiple_choice', makeMCItems(10)),
      makeBancoDoc('true_false', makeVFItems(8)),
      makeBancoDoc('ordenar', makeOrdenarItems(6))
    );

    const result = await repo.fetchAssembledQuiz(GRADO, WORLD_ID, 'seed-A');

    expect(result).toHaveLength(10);
    expect(result.filter((q) => q.tipo === 'multiple_choice')).toHaveLength(4);
    expect(result.filter((q) => q.tipo === 'true_false')).toHaveLength(3);
    expect(result.filter((q) => q.tipo === 'ordenar')).toHaveLength(3);
  });

  it('same seedKey → same set and order (determinism — anti R7)', async () => {
    const mcDoc = makeBancoDoc('multiple_choice', makeMCItems(10));
    const vfDoc = makeBancoDoc('true_false', makeVFItems(8));
    const ordDoc = makeBancoDoc('ordenar', makeOrdenarItems(6));

    const repo = await setupAndImport(mcDoc, vfDoc, ordDoc);
    const call1 = await repo.fetchAssembledQuiz(GRADO, WORLD_ID, 'same-seed');

    // Reset modules, import a fresh instance — same seed must yield same result
    jest.resetModules();
    const repo2 = await setupAndImport(mcDoc, vfDoc, ordDoc);
    const call2 = await repo2.fetchAssembledQuiz(GRADO, WORLD_ID, 'same-seed');

    expect(call1.map((q) => q.id)).toEqual(call2.map((q) => q.id));
  });

  it('different seedKey produces different subsets (per-student variation)', async () => {
    // Large pool (20 items per type) so different seeds select different items
    const repo = await setupAndImport(
      makeBancoDoc('multiple_choice', makeMCItems(20)),
      makeBancoDoc('true_false', makeVFItems(20)),
      makeBancoDoc('ordenar', makeOrdenarItems(20))
    );

    const callA = await repo.fetchAssembledQuiz(GRADO, WORLD_ID, 'seed-AAA');
    const callB = await repo.fetchAssembledQuiz(GRADO, WORLD_ID, 'seed-ZZZ');

    // Both must be 10 items regardless of seed
    expect(callA).toHaveLength(10);
    expect(callB).toHaveLength(10);

    // With large pools, seeds produce different selections (order or items differ)
    const idsA = callA.map((q) => q.id).join(',');
    const idsB = callB.map((q) => q.id).join(',');
    expect(idsA).not.toBe(idsB);
  });

  it('returns [] when any banco has fewer items than required (MC < 4)', async () => {
    const repo = await setupAndImport(
      makeBancoDoc('multiple_choice', makeMCItems(2)), // too few
      makeBancoDoc('true_false', makeVFItems(8)),
      makeBancoDoc('ordenar', makeOrdenarItems(6))
    );

    const result = await repo.fetchAssembledQuiz(GRADO, WORLD_ID, 'seed');
    expect(result).toHaveLength(0);
  });

  it('returns [] when a banco doc is missing (offline / not yet seeded)', async () => {
    const repo = await setupAndImport(
      makeBancoDoc('multiple_choice', makeMCItems(10)),
      null, // VF missing
      null // ordenar missing
    );

    const result = await repo.fetchAssembledQuiz(GRADO, WORLD_ID, 'seed');
    expect(result).toHaveLength(0);
  });
});

// ── quizUtils determinism tests ───────────────────────────────────────────────

describe('quizUtils (hashStr + stableShuffle)', () => {
  let hashStr: (s: string) => number;
  let stableShuffle: <T>(arr: T[], seed: number) => T[];

  beforeAll(async () => {
    const mod = await import('@shared/lib/quizUtils');
    hashStr = mod.hashStr;
    stableShuffle = mod.stableShuffle;
  });

  it('hashStr returns same value for same input (deterministic)', () => {
    expect(hashStr('hello')).toBe(hashStr('hello'));
    expect(hashStr('uid-abc-123')).toBe(hashStr('uid-abc-123'));
  });

  it('hashStr returns different values for different inputs', () => {
    expect(hashStr('seed-A')).not.toBe(hashStr('seed-B'));
  });

  it('stableShuffle with same seed always returns same order', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const seed = hashStr('test-seed');
    expect(stableShuffle(arr, seed)).toEqual(stableShuffle(arr, seed));
  });

  it('stableShuffle does not use Math.random (smoke: override throws, shuffle does not)', () => {
    const original = Math.random;
    Math.random = (): number => {
      throw new Error('Math.random called — violates R7');
    };
    try {
      expect(() => stableShuffle([1, 2, 3], 42)).not.toThrow();
    } finally {
      Math.random = original;
    }
  });

  it('stableShuffle returns the same elements (permutation, no additions/deletions)', () => {
    const arr = ['a', 'b', 'c', 'd'];
    const shuffled = stableShuffle(arr, hashStr('any-seed'));
    expect([...shuffled].sort()).toEqual([...arr].sort());
  });
});
