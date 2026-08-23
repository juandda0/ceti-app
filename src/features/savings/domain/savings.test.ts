import {
  goalStatus,
  isSavingsGoal,
  isSavingsOperation,
  projectSavings,
  type SavingsGoal,
  type SavingsOperation,
  validateSavingsChange,
} from '@features/savings/domain/savings';

const goal = (overrides: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id: 'g1',
  title: 'Bicicleta',
  iconId: 'bike',
  category: 'custom',
  targetAmount: 100,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const operation = (overrides: Partial<SavingsOperation> = {}): SavingsOperation => ({
  id: 'o1',
  type: 'aporte',
  amount: 80,
  description: '',
  fecha: 1,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe('dominio de ahorros', () => {
  it('separa ahorro asignado y sin asignar', () => {
    const projection = projectSavings(
      [goal()],
      [operation({ goalId: 'g1' }), operation({ id: 'o2', amount: 20 })]
    );

    expect(projection).toEqual({ total: 100, unassigned: 20, byGoal: { g1: 80 } });
  });

  it('trata una meta eliminada como ahorro sin asignar', () => {
    const projection = projectSavings([goal({ deletedAt: 2 })], [operation({ goalId: 'g1' })]);

    expect(projection).toEqual({ total: 80, unassigned: 80, byGoal: {} });
  });

  it('resta retiros y permite sobreahorro', () => {
    const projection = projectSavings(
      [goal()],
      [
        operation({ amount: 150, goalId: 'g1' }),
        operation({ id: 'o2', type: 'retiro', amount: 20, goalId: 'g1' }),
      ]
    );

    expect(projection.byGoal.g1).toBe(130);
    expect(goalStatus(goal(), projection)).toBe('cumplida');
  });

  it('rechaza ahorro sin asignar negativo', () => {
    expect(validateSavingsChange([], [operation({ type: 'retiro', amount: 1 })])).toEqual({
      ok: false,
      reason: 'insufficient_unassigned',
    });
  });

  it('rechaza una meta negativa aunque el total siga positivo', () => {
    expect(
      validateSavingsChange(
        [goal()],
        [
          operation({ amount: 10 }),
          operation({ id: 'o2', type: 'retiro', amount: 1, goalId: 'g1' }),
        ]
      )
    ).toEqual({ ok: false, reason: 'insufficient_goal' });
  });

  it('valida catálogos y rechaza campos extra', () => {
    expect(isSavingsGoal(goal())).toBe(true);
    expect(isSavingsGoal({ ...goal(), iconId: 'https://example.com/a.svg' })).toBe(false);
    expect(isSavingsOperation(operation())).toBe(true);
    expect(isSavingsOperation({ ...operation(), leaked: true })).toBe(false);
  });
});
