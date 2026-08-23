// El store dispara sync fire-and-forget vía dynamic import(); mockeamos esos
// módulos para que el side-effect resuelva limpio. La lógica pura queda intacta.
import { useMovimientosStore } from '@features/savings/store/useMovimientosStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { logEvent } from '@shared/lib/analytics/logEvent';

jest.mock('@shared/lib/analytics/logEvent', () => ({ logEvent: jest.fn() }));
jest.mock('@shared/lib/analytics/crashlytics', () => ({ recordError: jest.fn() }));
jest.mock('@features/auth/store/useAuthStore', () => ({
  useAuthStore: { getState: () => ({ firebaseUid: 'uid-test' }) },
}));
jest.mock('@features/savings/data/movimientosRepository', () => ({
  movimientosRepository: {
    upsertMovimiento: jest.fn().mockResolvedValue(true),
    removeMovimiento: jest.fn().mockResolvedValue(true),
  },
}));
jest.mock('@features/savings/data/depositsRepository', () => ({
  depositsRepository: { upsertDeposit: jest.fn().mockResolvedValue(true) },
}));
jest.mock('@features/savings/data/goalsRepository', () => ({
  goalsRepository: {
    upsertGoal: jest.fn().mockResolvedValue(true),
    removeGoal: jest.fn().mockResolvedValue(true),
  },
}));

const baseMovimiento = {
  tipo: 'gasto' as const,
  monto: 5000,
  descripcion: 'helado',
  categoria: 'comida' as const,
  origen: 'voz' as const,
};

// flush de las microtareas de los dynamic import() del store
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('useMovimientosStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMovimientosStore.setState({ movimientos: [] });
    useSavingsStore.setState({ goals: [], deposits: [] });
  });

  it('edita un gasto sin cambiar origen ni createdAt', async () => {
    const created = await useMovimientosStore.getState().createExpense({
      ...baseMovimiento,
      fecha: 1,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await useMovimientosStore.getState().updateExpense(created.value.id, {
      monto: 7000,
      categoria: 'transporte',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ monto: 7000, categoria: 'transporte', origen: 'voz' });
    expect(result.value.createdAt).toBe(created.value.createdAt);
  });

  it('un fallo al borrar restaura el gasto', async () => {
    useMovimientosStore.setState({
      movimientos: [{ ...baseMovimiento, id: 'm1', fecha: 1, createdAt: 1, updatedAt: 1 }],
    });
    const repository = jest.requireMock(
      '@features/savings/data/movimientosRepository'
    ).movimientosRepository;
    repository.removeMovimiento.mockRejectedValueOnce(new Error('offline'));

    const result = await useMovimientosStore.getState().deleteExpense('m1');

    expect(result).toEqual({ ok: false, reason: 'persistence_failed' });
    expect(useMovimientosStore.getState().movimientos).toContainEqual(
      expect.objectContaining({ id: 'm1' })
    );
  });

  it('agrega un movimiento con id y createdAt', () => {
    const mov = useMovimientosStore.getState().addMovimiento(baseMovimiento);
    expect(mov.id).toMatch(/^mov_/);
    expect(typeof mov.createdAt).toBe('number');
    expect(useMovimientosStore.getState().movimientos).toHaveLength(1);
  });

  it('analytics recibe SOLO origen y tipo — jamás monto/descripcion/categoria (CA6)', () => {
    useMovimientosStore.getState().addMovimiento(baseMovimiento);
    expect(logEvent).toHaveBeenCalledWith('movimiento_registrado', {
      origen: 'voz',
      tipo: 'gasto',
    });
    const params = (logEvent as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(params).sort()).toEqual(['origen', 'tipo']);
  });

  it('un ahorro con goalId alimenta la meta vía addDeposit (puente D-ES10-04)', async () => {
    const goal = useSavingsStore.getState().addGoal({
      title: 'Bici',
      description: '',
      emoji: '🚲',
      targetAmount: 100000,
      frequency: 'total',
      category: 'custom',
    });

    useMovimientosStore.getState().addMovimiento({
      ...baseMovimiento,
      tipo: 'ahorro',
      monto: 20000,
      goalId: goal.id,
    });
    await flush();

    const updated = useSavingsStore.getState().goals.find((g) => g.id === goal.id);
    expect(updated?.currentAmount).toBe(20000);
    expect(useSavingsStore.getState().deposits).toHaveLength(1);
  });

  it('borrar un ahorro ligado a meta revierte progreso y depósito (sin plata fantasma)', async () => {
    const goal = useSavingsStore.getState().addGoal({
      title: 'Bici',
      description: '',
      emoji: '🚲',
      targetAmount: 100000,
      frequency: 'total',
      category: 'custom',
    });

    const mov = useMovimientosStore.getState().addMovimiento({
      ...baseMovimiento,
      tipo: 'ahorro',
      monto: 100000,
      goalId: goal.id,
    });
    await flush();
    // El puente completó la meta.
    expect(useSavingsStore.getState().goals.find((g) => g.id === goal.id)?.currentAmount).toBe(
      100000
    );

    useMovimientosStore.getState().removeMovimiento(mov.id);
    await flush();

    const revertida = useSavingsStore.getState().goals.find((g) => g.id === goal.id);
    expect(revertida?.currentAmount).toBe(0);
    expect(revertida?.completedAt).toBeUndefined();
    expect(useSavingsStore.getState().getTotalSaved()).toBe(0);
    expect(useSavingsStore.getState().deposits).toHaveLength(0);
  });

  it('un gasto con goalId NO toca las metas', async () => {
    const goal = useSavingsStore.getState().addGoal({
      title: 'Bici',
      description: '',
      emoji: '🚲',
      targetAmount: 100000,
      frequency: 'total',
      category: 'custom',
    });

    useMovimientosStore.getState().addMovimiento({ ...baseMovimiento, goalId: goal.id });
    await flush();

    expect(useSavingsStore.getState().deposits).toHaveLength(0);
  });

  it('removeMovimiento elimina del estado', () => {
    const mov = useMovimientosStore.getState().addMovimiento(baseMovimiento);
    useMovimientosStore.getState().removeMovimiento(mov.id);
    expect(useMovimientosStore.getState().movimientos).toHaveLength(0);
  });

  it('resetMovimientos vacía el estado', () => {
    useMovimientosStore.getState().addMovimiento(baseMovimiento);
    useMovimientosStore.getState().resetMovimientos();
    expect(useMovimientosStore.getState().movimientos).toHaveLength(0);
  });
});
