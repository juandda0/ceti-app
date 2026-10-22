import { esClaseSoloLectura } from './useClaseSoloLectura';

// jest.mock se eleva sobre los imports (babel-jest).
jest.mock('@features/dashboard/data/rosterRepository', () => ({ rosterRepository: {} }));
jest.mock('@features/auth/store/useAuthStore', () => ({ useAuthStore: jest.fn() }));
jest.mock('../hooks/useMiPlan', () => ({ useMiPlan: jest.fn() }));

const cursos = [
  { id: 'vieja', createdAt: 1_000 },
  { id: 'media', createdAt: 2_000 },
  { id: 'nueva', createdAt: 3_000 },
];

describe('clases en solo lectura al bajar de plan', () => {
  it('con Cadete solo la más reciente queda editable', () => {
    expect(esClaseSoloLectura('cadete', cursos, 'nueva')).toBe(false);
    expect(esClaseSoloLectura('cadete', cursos, 'media')).toBe(true);
    expect(esClaseSoloLectura('cadete', cursos, 'vieja')).toBe(true);
  });

  it('con un plan pago o en prueba todo es editable', () => {
    for (const id of ['vieja', 'media', 'nueva']) {
      expect(esClaseSoloLectura('piloto', cursos, id)).toBe(false);
    }
  });

  it('una clase que no es del profe no se marca', () => {
    expect(esClaseSoloLectura('cadete', cursos, 'ajena')).toBe(false);
  });

  it('una sola clase con Cadete sigue editable', () => {
    expect(esClaseSoloLectura('cadete', [{ id: 'unica' }], 'unica')).toBe(false);
  });
});
