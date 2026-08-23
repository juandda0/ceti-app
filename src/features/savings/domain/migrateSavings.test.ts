import { migrateSavingsState } from '@features/savings/domain/migrateSavings';

describe('migrateSavingsState', () => {
  it('migra depósitos, deduplica el puente y asigna icono SVG', () => {
    const input = {
      goals: [
        {
          id: 'g1',
          title: 'Bici',
          emoji: '🚲',
          category: 'custom',
          targetAmount: 100,
          currentAmount: 50,
          frequency: 'total',
          description: '',
          createdAt: 1,
        },
      ],
      deposits: [{ id: 'mov_1', goalId: 'g1', amount: 50, description: 'Mesada', createdAt: 2 }],
      movimientos: [
        {
          id: 'mov_1',
          tipo: 'ahorro',
          monto: 50,
          descripcion: 'Mesada',
          categoria: 'otros',
          origen: 'voz',
          goalId: 'g1',
          createdAt: 2,
        },
        {
          id: 'mov_2',
          tipo: 'ahorro',
          monto: 20,
          descripcion: 'Regalo',
          categoria: 'regalos',
          origen: 'manual',
          createdAt: 3,
        },
        {
          id: 'mov_3',
          tipo: 'gasto',
          monto: 10,
          descripcion: 'Bus',
          categoria: 'transporte',
          origen: 'manual',
          createdAt: 4,
        },
      ],
    };

    const migrated = migrateSavingsState(input);
    expect(migrated.goals[0]).toMatchObject({ iconId: 'target', updatedAt: 1 });
    expect(migrated.operations.map((item) => item.id)).toEqual(['mov_1', 'mov_2']);
    expect(migrated.expenses.map((item) => item.id)).toEqual(['mov_3']);
    expect(migrateSavingsState(migrated)).toEqual(migrated);
  });
});
