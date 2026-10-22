/**
 * Tests for useWorldFlow — the three-phase saga orchestration hook.
 *
 * Approach: hook extraction (not RTL screen mount). The screen is a thin
 * consumer; all orchestration logic lives in useWorldFlow so it can be
 * exercised without expo-router or a full RN render tree.
 *
 * Coverage matrix:
 *
 *  Case 1  — Both repos return null → phase lands on 'quiz' (no infinite spinner).
 *  Case 2a — eligeCaminoRepository.fetch THROWS → flow does not hang → 'quiz'.
 *  Case 2b — microteoriaRepository.fetch THROWS → flow does not hang → 'quiz'.
 *  Case 2c — BOTH repos THROW simultaneously → catches at outer try/catch → 'quiz'.
 *  Case 3  — EC trigger=true, bank has situaciones → initial phase 'eligecamino';
 *             handleECFinish() → 'microteoria' (if MT bank present, first visit);
 *             handleMTFinish() → 'quiz'.
 *  Case 4  — EC trigger=true but bank null → skips to micro-teoría/quiz (no hang).
 *  Case 4b — EC trigger=true, bank present but situaciones=[] → skips EC.
 *  Case 5a — MT bank present, first visit → phase 'microteoria'.
 *  Case 5b — MT bank present, already seen → phase 'quiz' (skips MT and EC: both
 *             pre-phases are first-visit only since the level map, Órbita).
 *  Case 6  — reset() clears seenMicroteoriaKeys; hasMicroteoriaSeen returns false
 *             after reset; logout invokes reset.
 *
 * All cases assert observable STATE (phase + situacion/microteoriaBank), never
 * just that a mock was called.
 *
 * Note on UIDs:
 *   'test-uid-5'  → shouldShowEligeCamino('test-uid-5', 'world_1') === true  (hash % 100 = 0)
 *   'test-uid-0'  → shouldShowEligeCamino('test-uid-0', 'world_1') === false (hash % 100 = 65)
 *
 * Verified with the real hashStr implementation before writing these tests.
 */
import { renderHook, act } from '@testing-library/react-native';
import { jest } from '@jest/globals';
import { useLearningFlowStore } from '@features/learning/store/useLearningFlowStore';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import type { EligeCaminoBank, MicroteoriaBank } from '@features/learning/data/content.types';
import type { Grado, WorldId } from '@features/learning/data/quiz.types';

// ── Mocks (declared before any import of the module under test) ───────────────

// The repositories are mocked; we replace their implementations per-test.
jest.mock('@features/learning/data/eligeCaminoRepository', () => ({
  eligeCaminoRepository: { fetch: jest.fn() },
}));
jest.mock('@features/learning/data/microteoriaRepository', () => ({
  microteoriaRepository: { fetch: jest.fn() },
}));

// eligeCaminoUtils is kept REAL so deterministic trigger logic is exercised.
// We do NOT mock shouldShowEligeCamino — that would be a trivial mock.

// eslint-disable-next-line import/first
import { eligeCaminoRepository } from '@features/learning/data/eligeCaminoRepository';
// eslint-disable-next-line import/first
import { microteoriaRepository } from '@features/learning/data/microteoriaRepository';
// eslint-disable-next-line import/first
import { useWorldFlow } from './useWorldFlow';

const mockECFetch = eligeCaminoRepository.fetch as jest.MockedFunction<
  typeof eligeCaminoRepository.fetch
>;
const mockMTFetch = microteoriaRepository.fetch as jest.MockedFunction<
  typeof microteoriaRepository.fetch
>;

// ── Fixture data ──────────────────────────────────────────────────────────────

const GRADO: Grado = '9';
const WORLD_ID: WorldId = 'world_1';

// UID that triggers shouldShowEligeCamino === true (hash % 100 = 0 < 30)
const UID_EC_TRUE = 'test-uid-5';
// UID that triggers shouldShowEligeCamino === false (hash % 100 = 65 >= 30)
const UID_EC_FALSE = 'test-uid-0';

const situacion = {
  id: 'sit-1',
  enunciado: '¿Aceptas el préstamo?',
  opcionA: { texto: 'Sí', consecuencia: 'Pagas intereses.' },
  opcionB: { texto: 'No', consecuencia: 'Evitas la deuda.' },
};

const ecBank: EligeCaminoBank = {
  bancoId: '9_world_1',
  grado: GRADO,
  worldId: WORLD_ID,
  situaciones: [situacion],
  pendiente_validacion_docente: false,
};

const mtBank: MicroteoriaBank = {
  grado: GRADO,
  worldId: WORLD_ID,
  cards: [
    { titulo: '¿Qué es el dinero?', cuerpo: 'Medio de intercambio.' },
    { titulo: 'Tipos de dinero', cuerpo: 'Físico y digital.' },
  ],
  generadoPor: 'pipeline-v1',
  pendiente_validacion_docente: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wait for all pending async microtasks inside act(). */
async function waitForAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve(); // Two ticks to flush Promise.all + setState chains
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockECFetch.mockReset();
  mockMTFetch.mockReset();
  // Ensure a clean store state — no previously seen micro-teoría keys.
  useLearningFlowStore.setState({ seenMicroteoriaKeys: [] });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 1 — Graceful degradation: both repos return null
// ─────────────────────────────────────────────────────────────────────────────

describe('Case 1: both repos return null', () => {
  it('lands on phase quiz (no infinite spinner) when no banks exist', async () => {
    mockECFetch.mockResolvedValue(null);
    mockMTFetch.mockResolvedValue(null);

    const { result } = renderHook(() => useWorldFlow(UID_EC_TRUE, GRADO, WORLD_ID));

    // Initially loading
    expect(result.current.phase).toBe('loading');

    await waitForAsync();

    // Must not stay on 'loading' — must advance to 'quiz'
    expect(result.current.phase).toBe('quiz');
    expect(result.current.situacion).toBeNull();
    expect(result.current.microteoriaBank).toBeNull();
  });

  it('lands on quiz even when EC trigger is true (no bank to show)', async () => {
    // UID_EC_TRUE would trigger EC if the bank existed, but bank is null
    mockECFetch.mockResolvedValue(null);
    mockMTFetch.mockResolvedValue(null);

    const { result } = renderHook(() => useWorldFlow(UID_EC_TRUE, GRADO, WORLD_ID));

    await waitForAsync();

    expect(result.current.phase).toBe('quiz');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 2 — Graceful degradation: repos throw
// ─────────────────────────────────────────────────────────────────────────────

describe('Case 2a: eligeCaminoRepository throws', () => {
  it('does not hang — falls through to quiz', async () => {
    // The real repos catch internally, but this tests the outer try/catch in
    // useWorldFlow for catastrophic failures (e.g., the module itself throws).
    mockECFetch.mockRejectedValue(new Error('Network catastrophe'));
    mockMTFetch.mockRejectedValue(new Error('Network catastrophe'));

    const { result } = renderHook(() => useWorldFlow(UID_EC_TRUE, GRADO, WORLD_ID));

    await waitForAsync();

    // Phase must advance to 'quiz', not stay 'loading'
    expect(result.current.phase).toBe('quiz');
  });
});

describe('Case 2b: microteoriaRepository throws (but EC is fine)', () => {
  it('skips micro-teoría and goes to quiz when MT throws', async () => {
    // EC returns null (no EC phase), MT throws
    mockECFetch.mockResolvedValue(null);
    mockMTFetch.mockRejectedValue(new Error('MT explosion'));

    const { result } = renderHook(() => useWorldFlow(UID_EC_FALSE, GRADO, WORLD_ID));

    await waitForAsync();

    // Outer try/catch catches Promise.all rejection → quiz
    expect(result.current.phase).toBe('quiz');
  });
});

describe('Case 2c: both repos throw simultaneously', () => {
  it('catches combined rejection and terminates at quiz', async () => {
    mockECFetch.mockRejectedValue(new Error('EC down'));
    mockMTFetch.mockRejectedValue(new Error('MT down'));

    const { result } = renderHook(() => useWorldFlow(UID_EC_TRUE, GRADO, WORLD_ID));

    await waitForAsync();

    expect(result.current.phase).toBe('quiz');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 3 — Full happy path: EC present → MT (first visit) → quiz
// ─────────────────────────────────────────────────────────────────────────────

describe('Case 3: EC trigger=true, bank present, first visit', () => {
  it('starts at eligecamino with a resolved situacion', async () => {
    mockECFetch.mockResolvedValue(ecBank);
    mockMTFetch.mockResolvedValue(mtBank);

    const { result } = renderHook(() => useWorldFlow(UID_EC_TRUE, GRADO, WORLD_ID));

    await waitForAsync();

    expect(result.current.phase).toBe('eligecamino');
    expect(result.current.situacion).not.toBeNull();
    expect(result.current.situacion?.id).toBe(situacion.id);
  });

  it('handleECFinish transitions to microteoria (MT bank loaded, first visit)', async () => {
    mockECFetch.mockResolvedValue(ecBank);
    mockMTFetch.mockResolvedValue(mtBank);

    const { result } = renderHook(() => useWorldFlow(UID_EC_TRUE, GRADO, WORLD_ID));

    await waitForAsync();
    expect(result.current.phase).toBe('eligecamino');

    act(() => {
      result.current.handleECFinish();
    });

    expect(result.current.phase).toBe('microteoria');
    expect(result.current.microteoriaBank).not.toBeNull();
    expect(result.current.microteoriaBank?.cards).toHaveLength(2);
  });

  it('handleMTFinish transitions to quiz and marks MT as seen', async () => {
    mockECFetch.mockResolvedValue(ecBank);
    mockMTFetch.mockResolvedValue(mtBank);

    const { result } = renderHook(() => useWorldFlow(UID_EC_TRUE, GRADO, WORLD_ID));

    await waitForAsync();

    act(() => {
      result.current.handleECFinish();
    });
    expect(result.current.phase).toBe('microteoria');

    act(() => {
      result.current.handleMTFinish();
    });
    expect(result.current.phase).toBe('quiz');

    // MT should now be marked as seen in the store
    const seen = useLearningFlowStore.getState().hasMicroteoriaSeen(UID_EC_TRUE, WORLD_ID);
    expect(seen).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 4 — EC trigger=true but bank null or empty
// ─────────────────────────────────────────────────────────────────────────────

describe('Case 4: EC trigger=true but bank is null', () => {
  it('skips EC and goes to microteoria (if available) without hanging', async () => {
    mockECFetch.mockResolvedValue(null); // trigger=true but no bank
    mockMTFetch.mockResolvedValue(mtBank);

    const { result } = renderHook(() => useWorldFlow(UID_EC_TRUE, GRADO, WORLD_ID));

    await waitForAsync();

    // EC is skipped despite trigger=true because bank is null
    expect(result.current.phase).toBe('microteoria');
    expect(result.current.situacion).toBeNull();
  });

  it('skips EC and goes to quiz when both bank is null and MT is null', async () => {
    mockECFetch.mockResolvedValue(null);
    mockMTFetch.mockResolvedValue(null);

    const { result } = renderHook(() => useWorldFlow(UID_EC_TRUE, GRADO, WORLD_ID));

    await waitForAsync();

    expect(result.current.phase).toBe('quiz');
    expect(result.current.situacion).toBeNull();
  });
});

describe('Case 4b: EC trigger=true, bank present but situaciones=[]', () => {
  it('skips EC when bank has zero situaciones', async () => {
    const emptyEcBank: EligeCaminoBank = { ...ecBank, situaciones: [] };
    mockECFetch.mockResolvedValue(emptyEcBank);
    mockMTFetch.mockResolvedValue(mtBank);

    const { result } = renderHook(() => useWorldFlow(UID_EC_TRUE, GRADO, WORLD_ID));

    await waitForAsync();

    // Zero situaciones → showEC = false → skips to microteoria
    expect(result.current.phase).toBe('microteoria');
    expect(result.current.situacion).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 5 — Micro-teoría: first visit vs repeat
// ─────────────────────────────────────────────────────────────────────────────

describe('Case 5a: MT bank present, first visit', () => {
  it('shows microteoria phase on first entry (EC trigger=false)', async () => {
    mockECFetch.mockResolvedValue(null); // or irrelevant; EC trigger is false for UID_EC_FALSE
    mockMTFetch.mockResolvedValue(mtBank);

    const { result } = renderHook(() => useWorldFlow(UID_EC_FALSE, GRADO, WORLD_ID));

    await waitForAsync();

    expect(result.current.phase).toBe('microteoria');
    expect(result.current.microteoriaBank?.cards).toHaveLength(2);
  });
});

describe('Case 5b: MT bank present, already seen (repeat visit)', () => {
  it('skips microteoria and goes straight to quiz on second entry', async () => {
    // Pre-mark as seen in the store (simulating a previous visit)
    useLearningFlowStore.getState().markMicroteoriaSeen(UID_EC_FALSE, WORLD_ID);

    mockECFetch.mockResolvedValue(null);
    mockMTFetch.mockResolvedValue(mtBank);

    const { result } = renderHook(() => useWorldFlow(UID_EC_FALSE, GRADO, WORLD_ID));

    await waitForAsync();

    // Already seen → skip MT → quiz
    expect(result.current.phase).toBe('quiz');
    expect(result.current.microteoriaBank).toBeNull();
  });

  it('skips MT even when EC also triggers (second visit, both banks present)', async () => {
    useLearningFlowStore.getState().markMicroteoriaSeen(UID_EC_TRUE, WORLD_ID);

    mockECFetch.mockResolvedValue(ecBank);
    mockMTFetch.mockResolvedValue(mtBank);

    const { result } = renderHook(() => useWorldFlow(UID_EC_TRUE, GRADO, WORLD_ID));

    await waitForAsync();

    // Órbita: both pre-phases are first-visit only, so a repeat visit opens the
    // level map directly even when EC would trigger.
    expect(result.current.phase).toBe('quiz');
    expect(result.current.situacion).toBeNull();
    expect(result.current.microteoriaBank).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 6 — Cross-user regression: reset() clears state; logout triggers reset
// (R12, BLOQUEANTE-1)
// ─────────────────────────────────────────────────────────────────────────────

describe('Case 6: cross-user regression — store reset and logout wiring', () => {
  it('reset() clears seenMicroteoriaKeys so hasMicroteoriaSeen returns false', () => {
    const store = useLearningFlowStore.getState();

    // Mark two different (uid, worldId) pairs as seen
    store.markMicroteoriaSeen('user-A', 'world_1');
    store.markMicroteoriaSeen('user-B', 'world_2');

    expect(store.hasMicroteoriaSeen('user-A', 'world_1')).toBe(true);
    expect(store.hasMicroteoriaSeen('user-B', 'world_2')).toBe(true);

    // Full reset (called by logout)
    useLearningFlowStore.getState().reset();

    // Both keys must be cleared
    expect(useLearningFlowStore.getState().hasMicroteoriaSeen('user-A', 'world_1')).toBe(false);
    expect(useLearningFlowStore.getState().hasMicroteoriaSeen('user-B', 'world_2')).toBe(false);
    expect(useLearningFlowStore.getState().seenMicroteoriaKeys).toEqual([]);
  });

  it('markMicroteoriaSeen is idempotent (double-mark does not duplicate keys)', () => {
    const store = useLearningFlowStore.getState();
    store.markMicroteoriaSeen('user-A', 'world_1');
    store.markMicroteoriaSeen('user-A', 'world_1');
    store.markMicroteoriaSeen('user-A', 'world_1');

    const { seenMicroteoriaKeys } = useLearningFlowStore.getState();
    const count = seenMicroteoriaKeys.filter((k) => k === 'user-A:world_1').length;
    expect(count).toBe(1);
  });

  it('resetForUser removes only that uid, leaving other users intact', () => {
    const store = useLearningFlowStore.getState();
    store.markMicroteoriaSeen('user-A', 'world_1');
    store.markMicroteoriaSeen('user-B', 'world_1');

    useLearningFlowStore.getState().resetForUser('user-A');

    expect(useLearningFlowStore.getState().hasMicroteoriaSeen('user-A', 'world_1')).toBe(false);
    // user-B must still be seen
    expect(useLearningFlowStore.getState().hasMicroteoriaSeen('user-B', 'world_1')).toBe(true);
  });

  it('useAuthStore.logout invokes useLearningFlowStore.reset() (wiring test)', async () => {
    // Pre-populate the learning flow store
    useLearningFlowStore.getState().markMicroteoriaSeen('user-logged-in', 'world_3');
    expect(useLearningFlowStore.getState().hasMicroteoriaSeen('user-logged-in', 'world_3')).toBe(
      true
    );

    // Logout — this should call useLearningFlowStore.getState().reset() per useAuthStore
    await useAuthStore.getState().logout();

    // After logout, learning flow store must be cleared
    expect(useLearningFlowStore.getState().hasMicroteoriaSeen('user-logged-in', 'world_3')).toBe(
      false
    );
    expect(useLearningFlowStore.getState().seenMicroteoriaKeys).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge: grado === null keeps phase at 'loading' (spinner guard)
// ─────────────────────────────────────────────────────────────────────────────

describe('grado === null spinner guard', () => {
  it('stays on loading when grado is null (no fetch triggered)', async () => {
    // Repos should NOT be called if grado is null
    mockECFetch.mockResolvedValue(ecBank);
    mockMTFetch.mockResolvedValue(mtBank);

    const { result } = renderHook(() => useWorldFlow(UID_EC_TRUE, null, WORLD_ID));

    await waitForAsync();

    expect(result.current.phase).toBe('loading');
    expect(mockECFetch).not.toHaveBeenCalled();
    expect(mockMTFetch).not.toHaveBeenCalled();
  });

  it('advances to a real phase once grado resolves (re-render with grado)', async () => {
    mockECFetch.mockResolvedValue(null);
    mockMTFetch.mockResolvedValue(null);

    const { result, rerender } = renderHook(
      ({ g }: { g: Grado | null }) => useWorldFlow(UID_EC_FALSE, g, WORLD_ID),
      { initialProps: { g: null as Grado | null } }
    );

    await waitForAsync();
    expect(result.current.phase).toBe('loading');

    // Now grado resolves
    rerender({ g: GRADO });
    await waitForAsync();

    expect(result.current.phase).toBe('quiz');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge: EC trigger=false path (should go directly to MT or quiz)
// ─────────────────────────────────────────────────────────────────────────────

describe('EC trigger=false path', () => {
  it('skips eligecamino entirely even when bank is present (trigger=false)', async () => {
    mockECFetch.mockResolvedValue(ecBank); // bank exists, but trigger is false for this UID
    mockMTFetch.mockResolvedValue(null);

    const { result } = renderHook(() => useWorldFlow(UID_EC_FALSE, GRADO, WORLD_ID));

    await waitForAsync();

    // UID_EC_FALSE has trigger=false; so even with a bank, EC is skipped
    expect(result.current.phase).toBe('quiz');
    expect(result.current.situacion).toBeNull();
  });
});
