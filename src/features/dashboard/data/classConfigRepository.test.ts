import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { api } from '@shared/lib/api/client';

jest.mock('@shared/lib/api/client', () => ({
  api: { getOrNull: jest.fn(), put: jest.fn().mockResolvedValue(null) },
  isBackendConfigured: () => true,
  seg: encodeURIComponent,
}));
jest.mock('@shared/lib/analytics/errorReporting', () => ({ recordError: jest.fn() }));

const getOrNull = jest.mocked(api.getOrNull);
const flush = () => new Promise((r) => setImmediate(r));
const config = (version: number) => ({
  mundos: [{ worldId: 'world_1', activo: true }],
  version,
  updatedAt: 1,
  updatedByUid: 'p1',
});

describe('classConfigRepository.subscribe', () => {
  beforeEach(() => getOrNull.mockReset());

  it('solo notifica cuando la config cambia y una escritura propia refresca al instante', async () => {
    const seen: (number | null)[] = [];
    getOrNull.mockResolvedValue(config(1));
    const unsubscribe = classConfigRepository.subscribe('c', 'k', (c) => seen.push(c?.version ?? null));
    await flush();
    expect(seen).toEqual([1]);

    // Mismo contenido → sin notificación duplicada.
    classConfigRepository.notifyChanged('c', 'k');
    await flush();
    expect(seen).toEqual([1]);

    // El profesor guarda: se ve sin esperar el sondeo.
    getOrNull.mockResolvedValue(config(2));
    await classConfigRepository.upsert('c', 'k', config(2));
    await flush();
    expect(seen).toEqual([1, 2]);

    unsubscribe();
    getOrNull.mockResolvedValue(config(3));
    classConfigRepository.notifyChanged('c', 'k');
    await flush();
    expect(seen).toEqual([1, 2]);
  });

  it('un error de red resuelve a defaults (null) sin lanzar a la UI', async () => {
    const seen: unknown[] = [];
    getOrNull.mockRejectedValue(new Error('offline'));
    const unsubscribe = classConfigRepository.subscribe('c', 'x', (c) => seen.push(c));
    await flush();
    expect(seen).toEqual([null]);
    unsubscribe();
  });
});
