import { buildActivity } from '@features/savings/components/ActivityList';

describe('buildActivity', () => {
  it('ordena gastos y ahorro sin mezclarlos', () => {
    const expenses = [
      {
        id: 'm2',
        tipo: 'gasto' as const,
        monto: 5,
        descripcion: 'Bus',
        categoria: 'transporte' as const,
        origen: 'manual' as const,
        fecha: 2,
        createdAt: 2,
      },
    ];
    const operations = [
      {
        id: 'a3',
        type: 'aporte' as const,
        amount: 10,
        description: '',
        fecha: 3,
        createdAt: 3,
        updatedAt: 3,
      },
      {
        id: 'r1',
        type: 'retiro' as const,
        amount: 2,
        description: '',
        fecha: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    expect(buildActivity(expenses, operations).map((item) => item.id)).toEqual(['a3', 'm2', 'r1']);
  });
});
