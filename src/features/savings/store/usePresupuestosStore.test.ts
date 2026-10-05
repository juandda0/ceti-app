// El store sincroniza fire-and-forget vía dynamic import(); mockeamos esos
// módulos para que el side-effect resuelva limpio y poder aseverar el payload.
import { usePresupuestosStore } from '@features/savings/store/usePresupuestosStore';
import { logEvent } from '@shared/lib/analytics/logEvent';
import { presupuestosRepository } from '@features/savings/data/presupuestosRepository';

jest.mock('@shared/lib/analytics/logEvent', () => ({ logEvent: jest.fn() }));
jest.mock('@shared/lib/analytics/errorReporting', () => ({ recordError: jest.fn() }));
jest.mock('@features/savings/data/presupuestosRepository', () => ({
  presupuestosRepository: {
    guardar: jest.fn().mockResolvedValue(true),
    borrar: jest.fn().mockResolvedValue(true),
  },
}));
jest.mock('@features/auth/store/useAuthStore', () => ({
  useAuthStore: { getState: () => ({ uid: 'u1' }) },
}));

const guardar = presupuestosRepository.guardar as jest.Mock;
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('usePresupuestosStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePresupuestosStore.setState({ topes: {} });
  });

  it('setTope guarda el tope y persiste el mapa vía repo', async () => {
    usePresupuestosStore.getState().setTope('comida', 20000);
    expect(usePresupuestosStore.getState().topes).toEqual({ comida: 20000 });
    await flush();
    expect(guardar).toHaveBeenCalledWith({ comida: 20000 });
  });

  it('setTope(cat, null) elimina la clave del mapa', async () => {
    usePresupuestosStore.setState({ topes: { comida: 20000, transporte: 5000 } });
    usePresupuestosStore.getState().setTope('comida', null);
    expect(usePresupuestosStore.getState().topes).toEqual({ transporte: 5000 });
    await flush();
    expect(guardar).toHaveBeenLastCalledWith({ transporte: 5000 });
  });

  it('un tope ≤ 0 tampoco se guarda como valor', () => {
    usePresupuestosStore.setState({ topes: { comida: 20000 } });
    usePresupuestosStore.getState().setTope('comida', 0);
    expect(usePresupuestosStore.getState().topes).toEqual({});
  });

  it('analytics: presupuesto_definido SIN params, solo al fijar (CA9)', () => {
    usePresupuestosStore.getState().setTope('comida', 20000);
    expect(logEvent).toHaveBeenCalledWith('presupuesto_definido');
    (logEvent as jest.Mock).mockClear();
    usePresupuestosStore.getState().setTope('comida', null);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('saveBudgets revierte el estado cuando el backend falla', async () => {
    usePresupuestosStore.setState({ topes: { comida: 5000 } });
    guardar.mockRejectedValueOnce(new Error('offline'));

    const result = await usePresupuestosStore.getState().saveBudgets({ transporte: 7000 });

    expect(result).toEqual({ ok: false, reason: 'persistence_failed' });
    expect(usePresupuestosStore.getState().topes).toEqual({ comida: 5000 });
  });
});
