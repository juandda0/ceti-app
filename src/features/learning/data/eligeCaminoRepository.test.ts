/**
 * Tests for eligeCaminoRepository and microteoriaRepository.
 *
 * Covers:
 *  1. Returns a typed EligeCaminoBank when the doc exists.
 *  2. Returns null when the doc is missing.
 *  3. Returns null when the backend is not configured (offline mode).
 *  4. Returns null on a network error (fail-soft).
 *  5. Equivalent coverage for microteoriaRepository.
 */
import { jest } from '@jest/globals';
import type { EligeCaminoBank, MicroteoriaBank } from './content.types';

// ── Fake API responses ────────────────────────────────────────────────────────

type FakeResponse = { payload: unknown } | 'missing' | 'throw';

function presentSnap(payload: unknown): FakeResponse {
  return { payload };
}

function missingSnap(): FakeResponse {
  return 'missing';
}

// ── Sample payloads ───────────────────────────────────────────────────────────

const sampleEC: EligeCaminoBank = {
  bancoId: '9_world_1',
  grado: '9',
  worldId: 'world_1',
  situaciones: [
    {
      id: 's1',
      enunciado: 'Te ofrecen un préstamo fácil. ¿Qué haces?',
      opcionA: { texto: 'Lo acepto de inmediato', consecuencia: 'Pagas intereses altos.' },
      opcionB: { texto: 'Leo las condiciones', consecuencia: 'Tomas una decisión informada.' },
    },
  ],
  pendiente_validacion_docente: false,
};

const sampleMT: MicroteoriaBank = {
  grado: '9',
  worldId: 'world_1',
  cards: [
    { titulo: '¿Qué es el dinero?', cuerpo: 'El dinero es un medio de intercambio.' },
    {
      titulo: 'Tipos de dinero',
      cuerpo: 'Físico y digital.',
      ejemplo: 'Billetes vs. transferencias.',
    },
  ],
  generadoPor: 'pipeline-v1',
  pendiente_validacion_docente: false,
};

// ── Setup helper ──────────────────────────────────────────────────────────────

const getOrNull = jest.fn<(path: string) => Promise<unknown>>();

function mockApi(response: FakeResponse | 'offline') {
  getOrNull.mockReset();
  if (response === 'throw') getOrNull.mockRejectedValue(new Error('network error'));
  else if (response === 'missing' || response === 'offline') getOrNull.mockResolvedValue(null);
  else getOrNull.mockResolvedValue(response.payload);
  jest.doMock('@shared/lib/api/client', () => ({
    api: { getOrNull },
    isBackendConfigured: () => response !== 'offline',
    seg: encodeURIComponent,
  }));
  jest.doMock('@shared/lib/analytics/errorReporting', () => ({ recordError: jest.fn() }));
}

async function setupEC(response: FakeResponse) {
  mockApi(response);
  const { eligeCaminoRepository } = await import('./eligeCaminoRepository');
  return eligeCaminoRepository;
}

async function setupMT(response: FakeResponse) {
  mockApi(response);
  const { microteoriaRepository } = await import('./microteoriaRepository');
  return microteoriaRepository;
}

async function setupECOffline() {
  mockApi('offline');
  const { eligeCaminoRepository } = await import('./eligeCaminoRepository');
  return eligeCaminoRepository;
}

async function setupMTOffline() {
  mockApi('offline');
  const { microteoriaRepository } = await import('./microteoriaRepository');
  return microteoriaRepository;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('eligeCaminoRepository.fetch', () => {
  beforeEach(() => jest.resetModules());

  it('returns the typed bank when the doc exists', async () => {
    const repo = await setupEC(presentSnap(sampleEC));
    const result = await repo.fetch('9', 'world_1');
    expect(result).toEqual(sampleEC);
    expect(result?.situaciones).toHaveLength(1);
    expect(result?.situaciones[0]?.opcionA.consecuencia).toBe('Pagas intereses altos.');
    expect(getOrNull).toHaveBeenCalledWith('/api/content/elige-camino/9_world_1');
  });

  it('returns null when the doc does not exist', async () => {
    const repo = await setupEC(missingSnap());
    const result = await repo.fetch('9', 'world_1');
    expect(result).toBeNull();
  });

  it('returns null when the backend is not configured (offline)', async () => {
    const repo = await setupECOffline();
    const result = await repo.fetch('9', 'world_1');
    expect(result).toBeNull();
  });

  it('returns null on a network error (fail-soft)', async () => {
    const repo = await setupEC('throw');
    const result = await repo.fetch('9', 'world_1');
    expect(result).toBeNull();
  });
});

describe('microteoriaRepository.fetch', () => {
  beforeEach(() => jest.resetModules());

  it('returns the typed bank when the doc exists', async () => {
    const repo = await setupMT(presentSnap(sampleMT));
    const result = await repo.fetch('9', 'world_1');
    expect(result).toEqual(sampleMT);
    expect(result?.cards).toHaveLength(2);
    expect(result?.cards[1]?.ejemplo).toBe('Billetes vs. transferencias.');
    expect(getOrNull).toHaveBeenCalledWith('/api/content/microteoria/9_world_1');
  });

  it('returns null when the doc does not exist', async () => {
    const repo = await setupMT(missingSnap());
    const result = await repo.fetch('9', 'world_1');
    expect(result).toBeNull();
  });

  it('returns null when the backend is not configured (offline)', async () => {
    const repo = await setupMTOffline();
    const result = await repo.fetch('9', 'world_1');
    expect(result).toBeNull();
  });

  it('returns null on a network error (fail-soft)', async () => {
    const repo = await setupMT('throw');
    const result = await repo.fetch('9', 'world_1');
    expect(result).toBeNull();
  });
});
