// The store fires a fire-and-forget backend sync via dynamic import() inside
// addDeposit/removeGoal. We mock those modules so the side-effect resolves
// cleanly in the Jest VM. The pure client logic under test is untouched.
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { goalsRepository } from '@features/savings/data/goalsRepository';
import { logEvent } from '@shared/lib/analytics/logEvent';

jest.mock('@shared/lib/analytics/logEvent', () => ({ logEvent: jest.fn() }));
jest.mock('@shared/lib/analytics/errorReporting', () => ({ recordError: jest.fn() }));
jest.mock('@features/auth/store/useAuthStore', () => ({
  useAuthStore: { getState: () => ({ uid: 'uid-test' }) },
}));
jest.mock('@features/savings/data/depositsRepository', () => ({
  depositsRepository: {
    upsertDeposit: jest.fn().mockResolvedValue(true),
    upsertOperation: jest.fn().mockResolvedValue(true),
    removeDeposit: jest.fn().mockResolvedValue(true),
  },
}));
jest.mock('@features/savings/data/goalsRepository', () => ({
  goalsRepository: {
    upsertGoal: jest.fn().mockResolvedValue(true),
    removeGoal: jest.fn().mockResolvedValue(true),
  },
}));

const baseGoal = {
  title: 'Laptop',
  description: 'Para estudiar',
  emoji: '\u{1F4BB}',
  targetAmount: 1000,
  frequency: 'monthly' as const,
  category: 'electronics' as const,
};

describe('useSavingsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSavingsStore.setState({ goals: [], deposits: [], operations: [] });
  });

  describe('CRUD de producción', () => {
    it('goal_created no envía categoría financiera', async () => {
      await useSavingsStore.getState().createGoal({
        title: 'Bicicleta',
        iconId: 'bike',
        category: 'custom',
        targetAmount: 500000,
      });

      expect(logEvent).toHaveBeenCalledWith('goal_created');
    });

    it('elimina lógicamente una meta y libera su ahorro', async () => {
      const created = await useSavingsStore.getState().createGoal({
        title: 'Bici',
        iconId: 'bike',
        category: 'custom',
        targetAmount: 100,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      await useSavingsStore.getState().createOperation({
        type: 'aporte',
        amount: 80,
        description: '',
        goalId: created.value.id,
        fecha: 1,
      });

      const result = await useSavingsStore.getState().deleteGoal(created.value.id);

      expect(result.ok).toBe(true);
      expect(useSavingsStore.getState().projection()).toMatchObject({ total: 80, unassigned: 80 });
    });

    it('revierte una edición remota fallida', async () => {
      useSavingsStore.setState({
        goals: [
          {
            ...baseGoal,
            id: 'g1',
            iconId: 'target',
            currentAmount: 0,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        deposits: [],
        operations: [],
      });
      (goalsRepository.upsertGoal as jest.Mock).mockRejectedValueOnce(new Error('offline'));
      const before = useSavingsStore.getState().goals;

      const result = await useSavingsStore.getState().updateGoal('g1', { title: 'Nueva' });

      expect(result).toEqual({ ok: false, reason: 'persistence_failed' });
      expect(useSavingsStore.getState().goals).toEqual(before);
    });

    it('rechaza un retiro que deja una meta negativa', async () => {
      const created = await useSavingsStore.getState().createGoal({
        title: 'Bici',
        iconId: 'bike',
        category: 'custom',
        targetAmount: 100,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await useSavingsStore.getState().createOperation({
        type: 'retiro',
        amount: 1,
        description: '',
        goalId: created.value.id,
        fecha: 1,
      });

      expect(result).toEqual({ ok: false, reason: 'insufficient_goal' });
    });

    it('deposit_created no revela si el menor tiene una meta', () => {
      useSavingsStore.getState().addDeposit(50, 'Mesada', 'goal_1');

      expect(logEvent).toHaveBeenCalledWith('deposit_created');
    });

    it('savings_operation_created no revela si el menor tiene una meta', async () => {
      await useSavingsStore.getState().createOperation({
        type: 'aporte',
        amount: 50,
        description: '',
        goalId: 'goal_1',
        fecha: 1,
      });

      expect(logEvent).toHaveBeenCalledWith('savings_operation_created', { type: 'aporte' });
    });
  });

  describe('addGoal', () => {
    it('crea una meta con id, createdAt y currentAmount en 0', () => {
      const goal = useSavingsStore.getState().addGoal(baseGoal);

      expect(goal.id).toMatch(/^goal_/);
      expect(goal.currentAmount).toBe(0);
      expect(typeof goal.createdAt).toBe('number');
      expect(goal.title).toBe('Laptop');
      expect(goal.targetAmount).toBe(1000);
    });

    it('agrega la meta al arreglo de goals', () => {
      const goal = useSavingsStore.getState().addGoal(baseGoal);
      const goals = useSavingsStore.getState().goals;

      expect(goals).toHaveLength(1);
      expect(goals[0].id).toBe(goal.id);
    });

    it('mantiene las metas existentes al agregar otra', () => {
      const g1 = useSavingsStore.getState().addGoal(baseGoal);
      const g2 = useSavingsStore.getState().addGoal({ ...baseGoal, title: 'Viaje' });

      const goals = useSavingsStore.getState().goals;
      expect(goals).toHaveLength(2);
      expect(goals.map((g) => g.id)).toEqual([g1.id, g2.id]);
    });

    it('una meta nueva no esta completada', () => {
      const goal = useSavingsStore.getState().addGoal(baseGoal);
      expect(goal.completedAt).toBeUndefined();
    });
  });

  describe('addDeposit', () => {
    it('agrega un deposito al arreglo de deposits', () => {
      useSavingsStore.getState().addDeposit(50, 'Mesada');

      const deposits = useSavingsStore.getState().deposits;
      expect(deposits).toHaveLength(1);
      expect(deposits[0].amount).toBe(50);
      expect(deposits[0].description).toBe('Mesada');
      expect(deposits[0].id).toMatch(/^dep_/);
      expect(deposits[0].goalId).toBeUndefined();
    });

    it('un deposito sin goalId no modifica ninguna meta', () => {
      const goal = useSavingsStore.getState().addGoal(baseGoal);
      useSavingsStore.getState().addDeposit(200, 'General');

      const updated = useSavingsStore.getState().goals.find((g) => g.id === goal.id);
      expect(updated?.currentAmount).toBe(0);
    });

    it('un deposito con goalId suma al currentAmount de esa meta', () => {
      const goal = useSavingsStore.getState().addGoal(baseGoal);
      useSavingsStore.getState().addDeposit(150, 'Ahorro', goal.id);

      const updated = useSavingsStore.getState().goals.find((g) => g.id === goal.id);
      expect(updated?.currentAmount).toBe(150);
    });

    it('depositos acumulan sobre el currentAmount de la meta', () => {
      const goal = useSavingsStore.getState().addGoal(baseGoal);
      useSavingsStore.getState().addDeposit(100, 'a', goal.id);
      useSavingsStore.getState().addDeposit(250, 'b', goal.id);

      const updated = useSavingsStore.getState().goals.find((g) => g.id === goal.id);
      expect(updated?.currentAmount).toBe(350);
    });

    it('solo afecta la meta indicada por goalId', () => {
      const g1 = useSavingsStore.getState().addGoal(baseGoal);
      const g2 = useSavingsStore.getState().addGoal({ ...baseGoal, title: 'Otra' });
      useSavingsStore.getState().addDeposit(80, 'x', g2.id);

      const goals = useSavingsStore.getState().goals;
      expect(goals.find((g) => g.id === g1.id)?.currentAmount).toBe(0);
      expect(goals.find((g) => g.id === g2.id)?.currentAmount).toBe(80);
    });

    it('guarda la nota cuando se proporciona', () => {
      useSavingsStore.getState().addDeposit(10, 'desc', undefined, 'mi nota');
      expect(useSavingsStore.getState().deposits[0].note).toBe('mi nota');
    });
  });

  describe('completion logic', () => {
    it('marca completedAt cuando currentAmount alcanza targetAmount', () => {
      const goal = useSavingsStore.getState().addGoal(baseGoal);
      useSavingsStore.getState().addDeposit(1000, 'completar', goal.id);

      const updated = useSavingsStore.getState().goals.find((g) => g.id === goal.id);
      expect(updated?.currentAmount).toBe(1000);
      expect(typeof updated?.completedAt).toBe('number');
    });

    it('marca completedAt cuando se supera el targetAmount', () => {
      const goal = useSavingsStore.getState().addGoal(baseGoal);
      useSavingsStore.getState().addDeposit(1200, 'exceso', goal.id);

      const updated = useSavingsStore.getState().goals.find((g) => g.id === goal.id);
      expect(updated?.completedAt).toBeDefined();
    });

    it('no marca completedAt si no se alcanza el targetAmount', () => {
      const goal = useSavingsStore.getState().addGoal(baseGoal);
      useSavingsStore.getState().addDeposit(999, 'casi', goal.id);

      const updated = useSavingsStore.getState().goals.find((g) => g.id === goal.id);
      expect(updated?.completedAt).toBeUndefined();
    });

    it('no sobreescribe completedAt en depositos posteriores', () => {
      const goal = useSavingsStore.getState().addGoal(baseGoal);
      useSavingsStore.getState().addDeposit(1000, 'completa', goal.id);
      const firstCompletedAt = useSavingsStore
        .getState()
        .goals.find((g) => g.id === goal.id)?.completedAt;

      useSavingsStore.getState().addDeposit(500, 'extra', goal.id);
      const updated = useSavingsStore.getState().goals.find((g) => g.id === goal.id);

      expect(updated?.completedAt).toBe(firstCompletedAt);
      expect(updated?.currentAmount).toBe(1500);
    });

    it('no marca completada una meta con targetAmount 0', () => {
      const goal = useSavingsStore.getState().addGoal({ ...baseGoal, targetAmount: 0 });
      useSavingsStore.getState().addDeposit(100, 'x', goal.id);

      const updated = useSavingsStore.getState().goals.find((g) => g.id === goal.id);
      expect(updated?.completedAt).toBeUndefined();
    });
  });

  describe('removeGoal', () => {
    it('elimina la meta indicada', () => {
      const g1 = useSavingsStore.getState().addGoal(baseGoal);
      const g2 = useSavingsStore.getState().addGoal({ ...baseGoal, title: 'Otra' });

      useSavingsStore.getState().removeGoal(g1.id);

      const goals = useSavingsStore.getState().goals;
      expect(goals).toHaveLength(1);
      expect(goals[0].id).toBe(g2.id);
    });

    it('no falla al eliminar un id inexistente', () => {
      useSavingsStore.getState().addGoal(baseGoal);
      useSavingsStore.getState().removeGoal('no_existe');
      expect(useSavingsStore.getState().goals).toHaveLength(1);
    });
  });

  describe('resetSavings', () => {
    it('vacia goals y deposits', () => {
      const goal = useSavingsStore.getState().addGoal(baseGoal);
      useSavingsStore.getState().addDeposit(100, 'x', goal.id);

      useSavingsStore.getState().resetSavings();

      const s = useSavingsStore.getState();
      expect(s.goals).toEqual([]);
      expect(s.deposits).toEqual([]);
    });
  });

  describe('getTotalSaved', () => {
    it('devuelve 0 sin depositos', () => {
      expect(useSavingsStore.getState().getTotalSaved()).toBe(0);
    });

    it('suma los montos de todos los depositos', () => {
      const goal = useSavingsStore.getState().addGoal(baseGoal);
      useSavingsStore.getState().addDeposit(100, 'a');
      useSavingsStore.getState().addDeposit(50, 'b', goal.id);
      useSavingsStore.getState().addDeposit(25, 'c');

      expect(useSavingsStore.getState().getTotalSaved()).toBe(175);
    });
  });

  describe('getGoalProgress', () => {
    it('devuelve 0 para una meta inexistente', () => {
      expect(useSavingsStore.getState().getGoalProgress('nope')).toBe(0);
    });

    it('devuelve el porcentaje de avance', () => {
      const goal = useSavingsStore.getState().addGoal(baseGoal);
      useSavingsStore.getState().addDeposit(250, 'x', goal.id);

      expect(useSavingsStore.getState().getGoalProgress(goal.id)).toBe(25);
    });

    it('limita el progreso a 100 aunque se supere el objetivo', () => {
      const goal = useSavingsStore.getState().addGoal(baseGoal);
      useSavingsStore.getState().addDeposit(2000, 'x', goal.id);

      expect(useSavingsStore.getState().getGoalProgress(goal.id)).toBe(100);
    });

    it('devuelve 0 cuando targetAmount es 0', () => {
      const goal = useSavingsStore.getState().addGoal({ ...baseGoal, targetAmount: 0 });
      expect(useSavingsStore.getState().getGoalProgress(goal.id)).toBe(0);
    });
  });
});
