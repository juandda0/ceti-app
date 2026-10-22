import { useNivelesStore } from './useNivelesStore';
import type { PoolMundo } from '@features/orbita/domain/niveles';

const mockFetchPool = jest.fn<Promise<PoolMundo | null>, unknown[]>();
jest.mock('@features/learning/data/QuestionBankRepository', () => ({
  questionBankRepository: { fetchPool: (...args: unknown[]) => mockFetchPool(...args) },
}));

const item = (tipo: string, i: number) => ({
  id: `${tipo}${i}`,
  enunciado: '',
  competencia: '',
  dificultad: 1,
  ...(tipo === 'mc'
    ? { tipo: 'multiple_choice', opciones: ['a', 'b'], correctIndex: 0 }
    : tipo === 'vf'
      ? { tipo: 'true_false', respuesta: true }
      : { tipo: 'ordenar', elementos: ['a', 'b'], ordenCanonico: [0, 1] }),
});
const pool = {
  mc: Array.from({ length: 8 }, (_, i) => item('mc', i)),
  vf: Array.from({ length: 6 }, (_, i) => item('vf', i)),
  ordenar: Array.from({ length: 6 }, (_, i) => item('or', i)),
} as unknown as PoolMundo;

describe('useNivelesStore', () => {
  beforeEach(() => useNivelesStore.getState().reiniciar());

  it('al recargar (otra versión de la clase) conserva los niveles anteriores', async () => {
    mockFetchPool.mockResolvedValueOnce(pool);
    await useNivelesStore.getState().cargar('9', 'world_1', 'uid', null);
    const antes = useNivelesStore.getState().porMundo.world_1?.niveles;
    expect(antes?.lecciones).toHaveLength(4);

    let resolver: (p: PoolMundo) => void = () => {};
    mockFetchPool.mockReturnValueOnce(new Promise((r) => (resolver = r)));
    const recarga = useNivelesStore
      .getState()
      .cargar('9', 'world_1', 'uid', { colegioId: 'c', cursoId: 'k', version: 2 });
    // Mientras carga, el mapa y la lección siguen teniendo sus niveles.
    expect(useNivelesStore.getState().porMundo.world_1).toMatchObject({ estado: 'cargando', niveles: antes });
    resolver(pool);
    await recarga;
    expect(useNivelesStore.getState().porMundo.world_1?.estado).toBe('listo');
  });

  it('si la recarga falla, sigue mostrando los últimos niveles buenos', async () => {
    mockFetchPool.mockResolvedValueOnce(pool);
    await useNivelesStore.getState().cargar('9', 'world_1', 'uid', null);
    mockFetchPool.mockRejectedValueOnce(new Error('offline'));
    await useNivelesStore
      .getState()
      .cargar('9', 'world_1', 'uid', { colegioId: 'c', cursoId: 'k', version: 3 });
    const e = useNivelesStore.getState().porMundo.world_1;
    expect(e?.estado).toBe('error');
    expect(e?.niveles?.jefe).toHaveLength(10);
  });
});
