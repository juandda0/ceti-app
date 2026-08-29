import type { FinancialAction } from './financialPlan';
import { executeFinancialPlan, type FinancialPlanDependencies } from './executeFinancialPlan';

const ok = { ok: true as const, value: { id: 'created' } };

function dependencies(): FinancialPlanDependencies {
  return {
    movements: [{ id: 'mov_1', tipo: 'gasto', fecha: 10 }],
    goals: [{ id: 'goal_1', deletedAt: undefined }],
    operations: [{ id: 'op_1', type: 'aporte', fecha: 20, goalId: 'goal_1' }],
    createExpense: jest.fn().mockResolvedValue(ok),
    updateExpense: jest.fn().mockResolvedValue(ok),
    deleteExpense: jest.fn().mockResolvedValue(ok),
    createGoal: jest.fn().mockResolvedValue(ok),
    updateGoal: jest.fn().mockResolvedValue(ok),
    deleteGoal: jest.fn().mockResolvedValue(ok),
    createOperation: jest.fn().mockResolvedValue(ok),
    updateOperation: jest.fn().mockResolvedValue(ok),
    deleteOperation: jest.fn().mockResolvedValue(ok),
    projection: jest.fn().mockReturnValue({ total: 100, unassigned: 0, byGoal: { goal_1: 100 } }),
    executedActionIds: new Set(),
  };
}

const expense: FinancialAction = {
  actionId: 'batch:0',
  domain: 'movimiento',
  operation: 'crear',
  payload: {
    tipo: 'gasto',
    monto: 12_000,
    descripcion: 'Almuerzo',
    categoria: 'comida',
    fecha: 10,
  },
  needsInput: [],
};

describe('executeFinancialPlan', () => {
  it('ejecuta varias acciones en orden y reporta cada resultado', async () => {
    const deps = dependencies();
    const removeGoal: FinancialAction = {
      actionId: 'batch:1',
      domain: 'meta',
      operation: 'eliminar',
      resourceId: 'goal_1',
      payload: {},
      needsInput: [],
    };

    const result = await executeFinancialPlan([expense, removeGoal], deps);

    expect(deps.createExpense).toHaveBeenCalledWith({ ...expense.payload, origen: 'voz' });
    expect(deps.deleteGoal).toHaveBeenCalledWith('goal_1');
    expect(result.map((item) => item.status)).toEqual(['success', 'success']);
    expect((deps.createExpense as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (deps.deleteGoal as jest.Mock).mock.invocationCallOrder[0]
    );
  });

  it('no repite un actionId exitoso, pero permite reintentar uno fallido', async () => {
    const deps = dependencies();
    (deps.createExpense as jest.Mock)
      .mockResolvedValueOnce({ ok: false, reason: 'persistence_failed' })
      .mockResolvedValueOnce(ok);

    expect((await executeFinancialPlan([expense], deps))[0]?.status).toBe('error');
    expect((await executeFinancialPlan([expense], deps))[0]?.status).toBe('success');
    expect((await executeFinancialPlan([expense], deps))[0]).toMatchObject({
      status: 'success',
      duplicate: true,
    });
    expect(deps.createExpense).toHaveBeenCalledTimes(2);
  });

  it('reserva el actionId antes del await para impedir confirmaciones concurrentes', async () => {
    const deps = dependencies();
    let resolveMutation: ((value: typeof ok) => void) | undefined;
    (deps.createExpense as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveMutation = resolve;
      })
    );

    const first = executeFinancialPlan([expense], deps);
    const second = executeFinancialPlan([expense], deps);
    resolveMutation?.(ok);
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(deps.createExpense).toHaveBeenCalledTimes(1);
    expect(firstResult[0]?.status).toBe('success');
    expect(secondResult[0]?.status).toBe('success');
  });

  it('libera una reserva fallida para permitir reintento', async () => {
    const deps = dependencies();
    let rejectMutation: ((reason: Error) => void) | undefined;
    (deps.createExpense as jest.Mock)
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectMutation = reject;
        })
      )
      .mockResolvedValueOnce(ok);

    const first = executeFinancialPlan([expense], deps);
    const concurrent = executeFinancialPlan([expense], deps);
    rejectMutation?.(new Error('offline'));
    const concurrentResults = await Promise.all([first, concurrent]);
    expect(concurrentResults.map(([result]) => result?.status)).toEqual(['error', 'error']);
    expect((await executeFinancialPlan([expense], deps))[0]?.status).toBe('success');
    expect(deps.createExpense).toHaveBeenCalledTimes(2);
  });

  it('despacha editar/eliminar movimiento al store que contiene el ID', async () => {
    const deps = dependencies();
    const editExpense: FinancialAction = {
      actionId: 'dispatch:0',
      domain: 'movimiento',
      operation: 'editar',
      resourceId: 'mov_1',
      payload: { monto: 20_000 },
      needsInput: [],
    };
    const deleteSaving: FinancialAction = {
      actionId: 'dispatch:1',
      domain: 'movimiento',
      operation: 'eliminar',
      resourceId: 'op_1',
      payload: {},
      needsInput: [],
    };

    await executeFinancialPlan([editExpense, deleteSaving], deps);

    expect(deps.updateExpense).toHaveBeenCalledWith('mov_1', { monto: 20_000 });
    expect(deps.deleteOperation).toHaveBeenCalledWith('op_1');
  });

  it('elimina un gasto encontrado en movimientos', async () => {
    const deps = dependencies();
    await executeFinancialPlan(
      [
        {
          actionId: 'delete-expense:0',
          domain: 'movimiento',
          operation: 'eliminar',
          resourceId: 'mov_1',
          payload: {},
          needsInput: [],
        },
      ],
      deps
    );
    expect(deps.deleteExpense).toHaveBeenCalledWith('mov_1');
  });

  it('mapea ahorro y CRUD de ahorro/meta a los métodos existentes', async () => {
    const deps = dependencies();
    const actions: FinancialAction[] = [
      {
        actionId: 'crud:0',
        domain: 'movimiento',
        operation: 'crear',
        needsInput: [],
        payload: {
          tipo: 'ahorro',
          monto: 5000,
          descripcion: 'Bici',
          categoria: 'otros',
          fecha: 10,
          goalId: 'goal_1',
        },
      },
      {
        actionId: 'crud:1',
        domain: 'ahorro',
        operation: 'editar',
        resourceId: 'op_1',
        needsInput: [],
        payload: { amount: 6000 },
      },
      {
        actionId: 'crud:2',
        domain: 'meta',
        operation: 'crear',
        needsInput: [],
        payload: { title: 'Bici', iconId: 'bike', category: 'custom', targetAmount: 100_000 },
      },
      {
        actionId: 'crud:3',
        domain: 'meta',
        operation: 'editar',
        resourceId: 'goal_1',
        needsInput: [],
        payload: { targetAmount: 120_000 },
      },
      {
        actionId: 'crud:4',
        domain: 'ahorro',
        operation: 'eliminar',
        resourceId: 'op_1',
        needsInput: [],
        payload: {},
      },
    ];

    await executeFinancialPlan(actions, deps);

    expect(deps.createOperation).toHaveBeenCalledWith({
      type: 'aporte',
      amount: 5000,
      description: 'Bici',
      fecha: 10,
      goalId: 'goal_1',
    });
    expect(deps.updateOperation).toHaveBeenCalledWith('op_1', { amount: 6000 });
    expect(deps.createGoal).toHaveBeenCalledWith(actions[2]?.payload);
    expect(deps.updateGoal).toHaveBeenCalledWith('goal_1', { targetAmount: 120_000 });
    expect(deps.deleteOperation).toHaveBeenCalledWith('op_1');
  });

  it('consulta gastos y ahorros normalizados, por tipo y rango', async () => {
    const deps = dependencies();
    deps.movements = [
      {
        id: 'old-expense',
        tipo: 'gasto',
        monto: 1,
        descripcion: 'Antes',
        categoria: 'otros',
        fecha: 5,
      },
      {
        id: 'expense',
        tipo: 'gasto',
        monto: 2,
        descripcion: 'Comida',
        categoria: 'comida',
        fecha: 15,
      },
    ];
    deps.operations = [
      { id: 'saving', type: 'aporte', amount: 3, description: 'Bici', fecha: 20, goalId: 'goal_1' },
      { id: 'late-saving', type: 'retiro', amount: 4, description: 'Después', fecha: 40 },
    ];
    const actions = [
      {
        actionId: 'query:0',
        domain: 'movimiento',
        operation: 'consultar',
        payload: { tipo: 'ahorro', desde: 10, hasta: 30 },
        needsInput: [],
      } as FinancialAction,
      {
        actionId: 'query:1',
        domain: 'movimiento',
        operation: 'consultar',
        payload: { desde: 10, hasta: 30 },
        needsInput: [],
      } as FinancialAction,
    ];

    const result = await executeFinancialPlan(actions, deps);

    expect(result[0]).toMatchObject({
      data: {
        movements: [
          {
            id: 'saving',
            tipo: 'ahorro',
            monto: 3,
            descripcion: 'Bici',
            fecha: 20,
            goalId: 'goal_1',
          },
        ],
      },
    });
    expect(result[1]).toMatchObject({
      data: {
        movements: [
          {
            id: 'expense',
            tipo: 'gasto',
            monto: 2,
            descripcion: 'Comida',
            categoria: 'comida',
            fecha: 15,
          },
          {
            id: 'saving',
            tipo: 'ahorro',
            monto: 3,
            descripcion: 'Bici',
            fecha: 20,
            goalId: 'goal_1',
          },
        ],
      },
    });
  });

  it('continúa tras excepción y permite reintentar la acción fallida', async () => {
    const deps = dependencies();
    (deps.deleteExpense as jest.Mock)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(ok);
    const removeExpense: FinancialAction = {
      actionId: 'throw:0',
      domain: 'movimiento',
      operation: 'eliminar',
      resourceId: 'mov_1',
      payload: {},
      needsInput: [],
    };
    const readGoals: FinancialAction = {
      actionId: 'throw:1',
      domain: 'meta',
      operation: 'consultar',
      payload: {},
      needsInput: [],
    };

    expect(
      (await executeFinancialPlan([removeExpense, readGoals], deps)).map((item) => item.status)
    ).toEqual(['error', 'success']);
    expect((await executeFinancialPlan([removeExpense], deps))[0]?.status).toBe('success');
    expect(deps.deleteExpense).toHaveBeenCalledTimes(2);
  });

  it('continúa tras error, bloquea needsInput y devuelve consultas estructuradas', async () => {
    const deps = dependencies();
    (deps.deleteGoal as jest.Mock).mockResolvedValue({ ok: false, reason: 'not_found' });
    const actions: FinancialAction[] = [
      {
        actionId: 'mixed:0',
        domain: 'meta',
        operation: 'eliminar',
        resourceId: 'missing',
        payload: {},
        needsInput: [],
      },
      {
        actionId: 'mixed:1',
        domain: 'ahorro',
        operation: 'consultar',
        payload: { goalId: 'goal_1' },
        needsInput: [],
      },
      {
        actionId: 'mixed:2',
        domain: 'meta',
        operation: 'crear',
        payload: {},
        needsInput: ['title'],
      },
    ];

    const result = await executeFinancialPlan(actions, deps);

    expect(result.map((item) => item.status)).toEqual(['error', 'success', 'error']);
    expect(result[0]).toMatchObject({ reason: 'not_found' });
    expect(result[1]).toMatchObject({
      data: {
        operations: [{ id: 'op_1' }],
        projection: { total: 100 },
      },
    });
    expect(result[2]).toMatchObject({ reason: 'needs_input' });
    expect(deps.createGoal).not.toHaveBeenCalled();
  });
});
