import type { SavingsOperation, SavingsProjection } from '@features/savings/domain/savings';
import type { Movimiento, MovimientoCategoria } from '@features/savings/store/useMovimientosStore';
import type { SavingsGoal } from '@features/savings/store/useSavingsStore';
import type { FinancialAction } from './financialPlan';

type MutationResult = { ok: true; value: unknown } | { ok: false; reason: string };

type ExpenseInput = {
  tipo: 'gasto';
  monto: number;
  descripcion: string;
  categoria: MovimientoCategoria;
  origen: 'voz';
  fecha?: number;
};

type OperationInput = {
  type: 'aporte' | 'retiro';
  amount: number;
  description: string;
  goalId?: string;
  fecha: number;
};

type GoalInput = {
  title: string;
  iconId: 'bike' | 'book' | 'laptop' | 'plane' | 'shield' | 'target';
  category: 'electronics' | 'toy' | 'trip' | 'education' | 'emergency' | 'custom';
  targetAmount: number;
  deadline?: number;
};

export interface FinancialPlanDependencies {
  movements: (Pick<Movimiento, 'id' | 'tipo'> & Partial<Movimiento>)[];
  goals: (Pick<SavingsGoal, 'id'> & Partial<SavingsGoal>)[];
  operations: (Pick<SavingsOperation, 'id' | 'type' | 'fecha'> & Partial<SavingsOperation>)[];
  createExpense(data: ExpenseInput): Promise<MutationResult>;
  updateExpense(
    id: string,
    changes: Partial<Pick<Movimiento, 'monto' | 'descripcion' | 'categoria' | 'fecha'>>
  ): Promise<MutationResult>;
  deleteExpense(id: string): Promise<MutationResult>;
  createGoal(data: GoalInput): Promise<MutationResult>;
  updateGoal(id: string, changes: Partial<GoalInput>): Promise<MutationResult>;
  deleteGoal(id: string): Promise<MutationResult>;
  createOperation(data: OperationInput): Promise<MutationResult>;
  updateOperation(id: string, changes: Partial<OperationInput>): Promise<MutationResult>;
  deleteOperation(id: string): Promise<MutationResult>;
  projection(): SavingsProjection;
  executedActionIds?: Set<string>;
}

export type ActionResult =
  | { actionId: string; status: 'success'; data?: unknown; duplicate?: true }
  | { actionId: string; status: 'error'; reason: string };

const sessionActionIds = new Set<string>();
const inFlightBySession = new WeakMap<Set<string>, Map<string, Promise<ActionResult>>>();

function inRange(item: { fecha?: number; createdAt?: number }, payload: Record<string, unknown>) {
  const date = item.fecha ?? item.createdAt ?? 0;
  return (
    (typeof payload.desde !== 'number' || date >= payload.desde) &&
    (typeof payload.hasta !== 'number' || date <= payload.hasta)
  );
}

function expenseChanges(payload: Record<string, unknown>) {
  const changes: Partial<Pick<Movimiento, 'monto' | 'descripcion' | 'categoria' | 'fecha'>> = {};
  if (typeof payload.monto === 'number') changes.monto = payload.monto;
  if (typeof payload.descripcion === 'string') changes.descripcion = payload.descripcion;
  if (typeof payload.categoria === 'string')
    changes.categoria = payload.categoria as MovimientoCategoria;
  if (typeof payload.fecha === 'number') changes.fecha = payload.fecha;
  return changes;
}

function operationChanges(payload: Record<string, unknown>): Partial<OperationInput> {
  const changes: Partial<OperationInput> = {};
  const type = payload.type ?? (payload.tipo === 'ahorro' ? 'aporte' : undefined);
  const amount = payload.amount ?? payload.monto;
  const description = payload.description ?? payload.descripcion;
  if (type === 'aporte' || type === 'retiro') changes.type = type;
  if (typeof amount === 'number') changes.amount = amount;
  if (typeof description === 'string') changes.description = description;
  if (typeof payload.goalId === 'string') changes.goalId = payload.goalId;
  if (typeof payload.fecha === 'number') changes.fecha = payload.fecha;
  return changes;
}

async function mutate(
  action: FinancialAction,
  deps: FinancialPlanDependencies
): Promise<MutationResult> {
  const payload = action.payload as Record<string, unknown>;
  if (action.domain === 'movimiento') {
    if (action.operation === 'crear') {
      if (payload.tipo === 'gasto')
        return deps.createExpense({ ...payload, origen: 'voz' } as ExpenseInput);
      return deps.createOperation({
        type: 'aporte',
        amount: payload.monto as number,
        description: payload.descripcion as string,
        fecha: payload.fecha as number,
        ...(typeof payload.goalId === 'string' ? { goalId: payload.goalId } : {}),
      });
    }
    const id = action.resourceId as string;
    const isExpense = deps.movements.some((item) => item.id === id && item.tipo === 'gasto');
    const isOperation = deps.operations.some((item) => item.id === id);
    if (!isExpense && !isOperation) return { ok: false, reason: 'not_found' };
    if (action.operation === 'editar')
      return isExpense
        ? deps.updateExpense(id, expenseChanges(payload))
        : deps.updateOperation(id, operationChanges(payload));
    return isExpense ? deps.deleteExpense(id) : deps.deleteOperation(id);
  }
  if (action.domain === 'ahorro') {
    if (action.operation === 'crear') return deps.createOperation(payload as OperationInput);
    if (action.operation === 'editar')
      return deps.updateOperation(action.resourceId as string, payload);
    return deps.deleteOperation(action.resourceId as string);
  }
  if (action.operation === 'crear') return deps.createGoal(payload as GoalInput);
  if (action.operation === 'editar') return deps.updateGoal(action.resourceId as string, payload);
  return deps.deleteGoal(action.resourceId as string);
}

function query(action: FinancialAction, deps: FinancialPlanDependencies): unknown {
  const payload = action.payload as Record<string, unknown>;
  if (action.domain === 'movimiento') {
    const expenses = deps.movements
      .filter((item) => inRange(item, payload))
      .map((item) => ({
        id: item.id,
        tipo: item.tipo,
        monto: item.monto,
        descripcion: item.descripcion,
        categoria: item.categoria,
        fecha: item.fecha ?? item.createdAt,
        ...(item.goalId ? { goalId: item.goalId } : {}),
      }));
    const savings = deps.operations
      .filter((item) => inRange(item, payload))
      .map((item) => ({
        id: item.id,
        tipo: 'ahorro' as const,
        monto: item.amount,
        descripcion: item.description,
        fecha: item.fecha,
        ...(item.goalId ? { goalId: item.goalId } : {}),
      }));
    return {
      movements: [...expenses, ...savings].filter(
        (item) => payload.tipo === undefined || item.tipo === payload.tipo
      ),
    };
  }
  if (action.domain === 'ahorro') {
    return {
      operations: deps.operations.filter(
        (item) =>
          inRange(item, payload) &&
          (payload.goalId === undefined || item.goalId === payload.goalId) &&
          (payload.type === undefined || item.type === payload.type)
      ),
      projection: deps.projection(),
    };
  }
  const projection = deps.projection();
  return {
    goals: deps.goals.filter(
      (goal) =>
        !goal.deletedAt && (action.resourceId === undefined || goal.id === action.resourceId)
    ),
    projection,
  };
}

export async function executeFinancialPlan(
  actions: FinancialAction[],
  dependencies: FinancialPlanDependencies
): Promise<ActionResult[]> {
  const completed = dependencies.executedActionIds ?? sessionActionIds;
  let inFlight = inFlightBySession.get(completed);
  if (!inFlight) {
    inFlight = new Map();
    inFlightBySession.set(completed, inFlight);
  }
  const results: ActionResult[] = [];
  for (const action of actions) {
    if (action.needsInput.length > 0) {
      results.push({ actionId: action.actionId, status: 'error', reason: 'needs_input' });
      continue;
    }
    if (completed.has(action.actionId)) {
      results.push({ actionId: action.actionId, status: 'success', duplicate: true });
      continue;
    }
    const existing = inFlight.get(action.actionId);
    if (existing) {
      results.push(await existing);
      continue;
    }
    const execution = (async (): Promise<ActionResult> => {
      try {
        if (action.operation === 'consultar') {
          const data = query(action, dependencies);
          completed.add(action.actionId);
          return { actionId: action.actionId, status: 'success', data };
        }
        const result = await mutate(action, dependencies);
        if (!result.ok) {
          return { actionId: action.actionId, status: 'error', reason: result.reason };
        }
        completed.add(action.actionId);
        return { actionId: action.actionId, status: 'success', data: result.value };
      } catch {
        return { actionId: action.actionId, status: 'error', reason: 'unexpected_error' };
      }
    })();
    inFlight.set(action.actionId, execution);
    try {
      results.push(await execution);
    } finally {
      inFlight.delete(action.actionId);
    }
  }
  return results;
}
