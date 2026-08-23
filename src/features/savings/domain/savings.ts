export const GOAL_ICON_IDS = ['bike', 'book', 'laptop', 'plane', 'shield', 'target'] as const;
export const GOAL_CATEGORIES = [
  'electronics',
  'toy',
  'trip',
  'education',
  'emergency',
  'custom',
] as const;

export type GoalIconId = (typeof GOAL_ICON_IDS)[number];
export type GoalCategory = (typeof GOAL_CATEGORIES)[number];
export type SavingsOperationType = 'aporte' | 'retiro';

export interface SavingsGoal {
  id: string;
  title: string;
  iconId: GoalIconId;
  category: GoalCategory;
  targetAmount: number;
  deadline?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface SavingsOperation {
  id: string;
  type: SavingsOperationType;
  amount: number;
  description: string;
  goalId?: string;
  fecha: number;
  createdAt: number;
  updatedAt: number;
}

export interface SavingsProjection {
  total: number;
  unassigned: number;
  byGoal: Record<string, number>;
}

const MAX_MONEY = 100_000_000;
const MAX_TITLE = 80;
const MAX_DESCRIPTION = 140;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnly(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isMoney(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= MAX_MONEY;
}

export function isGoalIconId(value: unknown): value is GoalIconId {
  return typeof value === 'string' && GOAL_ICON_IDS.includes(value as GoalIconId);
}

export function isSavingsGoal(value: unknown): value is SavingsGoal {
  if (!isRecord(value)) return false;
  if (
    !hasOnly(value, [
      'id',
      'title',
      'iconId',
      'category',
      'targetAmount',
      'deadline',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ])
  )
    return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 &&
    value.title.length <= MAX_TITLE &&
    isGoalIconId(value.iconId) &&
    typeof value.category === 'string' &&
    GOAL_CATEGORIES.includes(value.category as GoalCategory) &&
    isMoney(value.targetAmount) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    (value.deadline === undefined || isTimestamp(value.deadline)) &&
    (value.deletedAt === undefined || isTimestamp(value.deletedAt))
  );
}

export function isSavingsOperation(value: unknown): value is SavingsOperation {
  if (!isRecord(value)) return false;
  if (
    !hasOnly(value, [
      'id',
      'type',
      'amount',
      'description',
      'goalId',
      'fecha',
      'createdAt',
      'updatedAt',
    ])
  )
    return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    (value.type === 'aporte' || value.type === 'retiro') &&
    isMoney(value.amount) &&
    typeof value.description === 'string' &&
    value.description.length <= MAX_DESCRIPTION &&
    (value.goalId === undefined || (typeof value.goalId === 'string' && value.goalId.length > 0)) &&
    isTimestamp(value.fecha) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  );
}

export function projectSavings(
  goals: SavingsGoal[],
  operations: SavingsOperation[]
): SavingsProjection {
  const active = new Set(goals.filter((goal) => !goal.deletedAt).map((goal) => goal.id));
  const byGoal: Record<string, number> = {};
  let total = 0;
  let unassigned = 0;

  for (const operation of operations) {
    const signed = operation.type === 'aporte' ? operation.amount : -operation.amount;
    total += signed;
    if (operation.goalId && active.has(operation.goalId)) {
      byGoal[operation.goalId] = (byGoal[operation.goalId] ?? 0) + signed;
    } else {
      unassigned += signed;
    }
  }

  return { total, unassigned, byGoal };
}

export function validateSavingsChange(goals: SavingsGoal[], operations: SavingsOperation[]) {
  const projection = projectSavings(goals, operations);
  if (projection.total < 0 || projection.unassigned < 0) {
    return { ok: false as const, reason: 'insufficient_unassigned' as const };
  }
  if (Object.values(projection.byGoal).some((amount) => amount < 0)) {
    return { ok: false as const, reason: 'insufficient_goal' as const };
  }
  return { ok: true as const, projection };
}

export function goalStatus(
  goal: SavingsGoal,
  projection: SavingsProjection
): 'activa' | 'cumplida' {
  return (projection.byGoal[goal.id] ?? 0) >= goal.targetAmount ? 'cumplida' : 'activa';
}
