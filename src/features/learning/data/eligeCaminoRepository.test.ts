/**
 * Tests for eligeCaminoRepository and microteoriaRepository.
 *
 * Covers:
 *  1. Returns a typed EligeCaminoBank when the doc exists.
 *  2. Returns null when the doc is missing.
 *  3. Returns null when Firebase is not configured (demo mode).
 *  4. Returns null on a network error (fail-soft).
 *  5. Equivalent coverage for microteoriaRepository.
 */
import { jest } from '@jest/globals';
import type { EligeCaminoBank, MicroteoriaBank } from './content.types';

// ── Fake snap helpers ─────────────────────────────────────────────────────────

interface FakeSnap {
  exists(): boolean;
  data(): unknown;
}

function presentSnap(payload: unknown): FakeSnap {
  return { exists: () => true, data: () => payload };
}

function missingSnap(): FakeSnap {
  return { exists: () => false, data: () => undefined };
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

async function setupEC(snap: FakeSnap | 'throw') {
  jest.doMock('@shared/lib/firebase/app', () => ({
    getFirebaseClients: () => ({ firestore: {} }),
  }));
  jest.doMock('@shared/lib/firebase/paths', () => ({
    eligeCaminoDocRef: () => ({ __id: 'eligecamino-ref' }),
  }));
  jest.doMock('firebase/firestore', () => ({
    getDoc:
      snap === 'throw'
        ? jest.fn(() => Promise.reject(new Error('network error')))
        : jest.fn(() => Promise.resolve(snap)),
  }));
  const { eligeCaminoRepository } = await import('./eligeCaminoRepository');
  return eligeCaminoRepository;
}

async function setupMT(snap: FakeSnap | 'throw') {
  jest.doMock('@shared/lib/firebase/app', () => ({
    getFirebaseClients: () => ({ firestore: {} }),
  }));
  jest.doMock('@shared/lib/firebase/paths', () => ({
    microteoriaDocRef: () => ({ __id: 'microteoria-ref' }),
  }));
  jest.doMock('firebase/firestore', () => ({
    getDoc:
      snap === 'throw'
        ? jest.fn(() => Promise.reject(new Error('network error')))
        : jest.fn(() => Promise.resolve(snap)),
  }));
  const { microteoriaRepository } = await import('./microteoriaRepository');
  return microteoriaRepository;
}

async function setupECOffline() {
  jest.doMock('@shared/lib/firebase/app', () => ({
    getFirebaseClients: () => null, // offline / demo
  }));
  jest.doMock('@shared/lib/firebase/paths', () => ({
    eligeCaminoDocRef: () => ({}),
  }));
  const { eligeCaminoRepository } = await import('./eligeCaminoRepository');
  return eligeCaminoRepository;
}

async function setupMTOffline() {
  jest.doMock('@shared/lib/firebase/app', () => ({
    getFirebaseClients: () => null,
  }));
  jest.doMock('@shared/lib/firebase/paths', () => ({
    microteoriaDocRef: () => ({}),
  }));
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
  });

  it('returns null when the doc does not exist', async () => {
    const repo = await setupEC(missingSnap());
    const result = await repo.fetch('9', 'world_1');
    expect(result).toBeNull();
  });

  it('returns null when Firebase is not configured (demo / offline)', async () => {
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
  });

  it('returns null when the doc does not exist', async () => {
    const repo = await setupMT(missingSnap());
    const result = await repo.fetch('9', 'world_1');
    expect(result).toBeNull();
  });

  it('returns null when Firebase is not configured (demo / offline)', async () => {
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
