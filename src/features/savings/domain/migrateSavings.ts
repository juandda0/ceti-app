import {
  GOAL_CATEGORIES,
  type SavingsGoal,
  type SavingsOperation,
} from '@features/savings/domain/savings';

interface LegacyGoal {
  id: string;
  title: string;
  category: string;
  targetAmount: number;
  createdAt: number;
  iconId?: SavingsGoal['iconId'];
  deadline?: number;
  deletedAt?: number;
}

interface LegacyDeposit {
  id: string;
  goalId?: string;
  amount: number;
  description: string;
  createdAt: number;
  fecha?: number;
  updatedAt?: number;
}

interface LegacyMovement {
  id: string;
  tipo: string;
  monto: number;
  descripcion: string;
  categoria: string;
  origen: string;
  goalId?: string;
  createdAt: number;
  fecha?: number;
  updatedAt?: number;
}

export interface MigratedExpense {
  id: string;
  tipo: 'gasto';
  monto: number;
  descripcion: string;
  categoria: string;
  origen: 'voz' | 'manual';
  fecha: number;
  createdAt: number;
  updatedAt: number;
}

interface LegacyState {
  goals: LegacyGoal[];
  deposits?: LegacyDeposit[];
  operations?: SavingsOperation[];
  movimientos?: LegacyMovement[];
  expenses?: MigratedExpense[];
}

export interface MigratedSavingsState {
  goals: SavingsGoal[];
  operations: SavingsOperation[];
  expenses: MigratedExpense[];
}

export function migrateSavingsState(state: LegacyState): MigratedSavingsState {
  const goals = state.goals.map((goal) => ({
    id: goal.id,
    title: goal.title.trim(),
    iconId: goal.iconId ?? ('target' as const),
    category: GOAL_CATEGORIES.includes(goal.category as SavingsGoal['category'])
      ? (goal.category as SavingsGoal['category'])
      : 'custom',
    targetAmount: goal.targetAmount,
    ...(goal.deadline === undefined ? {} : { deadline: goal.deadline }),
    createdAt: goal.createdAt,
    updatedAt:
      'updatedAt' in goal && typeof goal.updatedAt === 'number' ? goal.updatedAt : goal.createdAt,
    ...(goal.deletedAt === undefined ? {} : { deletedAt: goal.deletedAt }),
  }));

  const operations = state.operations
    ? [...state.operations]
    : (state.deposits ?? []).map((deposit) => ({
        id: deposit.id,
        type: 'aporte' as const,
        amount: deposit.amount,
        description: deposit.description,
        ...(deposit.goalId ? { goalId: deposit.goalId } : {}),
        fecha: deposit.fecha ?? deposit.createdAt,
        createdAt: deposit.createdAt,
        updatedAt: deposit.updatedAt ?? deposit.createdAt,
      }));

  const operationIds = new Set(operations.map((operation) => operation.id));
  for (const movement of state.movimientos ?? []) {
    if (movement.tipo !== 'ahorro' || operationIds.has(movement.id)) continue;
    operations.push({
      id: movement.id,
      type: 'aporte',
      amount: movement.monto,
      description: movement.descripcion,
      ...(movement.goalId ? { goalId: movement.goalId } : {}),
      fecha: movement.fecha ?? movement.createdAt,
      createdAt: movement.createdAt,
      updatedAt: movement.updatedAt ?? movement.createdAt,
    });
    operationIds.add(movement.id);
  }

  const expenses = state.expenses
    ? [...state.expenses]
    : (state.movimientos ?? [])
        .filter((movement) => movement.tipo === 'gasto')
        .map((movement) => ({
          id: movement.id,
          tipo: 'gasto' as const,
          monto: movement.monto,
          descripcion: movement.descripcion,
          categoria: movement.categoria,
          origen: movement.origen === 'voz' ? ('voz' as const) : ('manual' as const),
          fecha: movement.fecha ?? movement.createdAt,
          createdAt: movement.createdAt,
          updatedAt: movement.updatedAt ?? movement.createdAt,
        }));

  return { goals, operations, expenses };
}
