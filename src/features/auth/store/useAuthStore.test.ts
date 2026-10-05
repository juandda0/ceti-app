import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useMovimientosStore } from '@features/savings/store/useMovimientosStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: false,
      lastLogin: null,
      authReady: false,
      uid: null,
    });
  });

  it('markAuthReady pone authReady en true', () => {
    useAuthStore.getState().markAuthReady();
    expect(useAuthStore.getState().authReady).toBe(true);
  });

  it('logout restaura estado inicial y mantiene authReady true', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      lastLogin: 1,
      authReady: true,
      uid: 'x',
    });
    await useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.lastLogin).toBeNull();
    expect(s.authReady).toBe(true);
  });

  it('logout limpia el diario de bolsillo (F1: sin fuga entre cuentas)', async () => {
    useMovimientosStore.getState().addMovimiento({
      tipo: 'gasto',
      monto: 5000,
      descripcion: 'helado',
      categoria: 'comida',
      origen: 'manual',
    });
    expect(useMovimientosStore.getState().movimientos.length).toBeGreaterThan(0);
    await useAuthStore.getState().logout();
    expect(useMovimientosStore.getState().movimientos).toHaveLength(0);
  });
});
