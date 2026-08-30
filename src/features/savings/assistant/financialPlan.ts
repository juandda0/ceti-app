import type { SavingsGoal, SavingsOperation } from '@features/savings/domain/savings';
import {
  MOVIMIENTO_CATEGORIAS,
  type Movimiento,
  type MovimientoCategoria,
} from '@features/savings/store/useMovimientosStore';

type MovementPayload = Partial<{
  tipo: 'gasto' | 'ahorro';
  monto: number;
  descripcion: string;
  categoria: MovimientoCategoria;
  fecha: number;
  goalId: string;
}>;
type SavingsPayload = Partial<{
  type: 'aporte' | 'retiro';
  amount: number;
  description: string;
  goalId: string;
  fecha: number;
}>;
type GoalPayload = Partial<{
  title: string;
  iconId: 'bike' | 'book' | 'laptop' | 'plane' | 'shield' | 'target';
  category: 'electronics' | 'toy' | 'trip' | 'education' | 'emergency' | 'custom';
  targetAmount: number;
  deadline: number;
}>;

export interface FinancialAction {
  actionId: string;
  domain: 'movimiento' | 'ahorro' | 'meta';
  operation: 'consultar' | 'crear' | 'editar' | 'eliminar';
  resourceId?: string;
  payload: MovementPayload | SavingsPayload | GoalPayload | Record<string, never>;
  needsInput: string[];
}

export interface FinancialPlan {
  actions: FinancialAction[];
  source: 'remote' | 'local';
}

type GoalContext = { id: string; title: string; targetAmount: number };
type MovementContext = {
  id: string;
  tipo: 'gasto' | 'ahorro';
  monto: number;
  descripcion: string;
  categoria: MovimientoCategoria;
  fecha: number;
  goalId?: string;
};
type OperationContext = {
  id: string;
  type: 'aporte' | 'retiro';
  amount: number;
  description: string;
  fecha: number;
  goalId?: string;
};

export interface FinancialContext {
  goals: GoalContext[];
  movements: MovementContext[];
  operations: OperationContext[];
}

type JsonObject = Record<string, unknown>;

const ICONS = ['bike', 'book', 'laptop', 'plane', 'shield', 'target'];
const GOAL_CATEGORIES = ['electronics', 'toy', 'trip', 'education', 'emergency', 'custom'];
const OPERATIONS = ['consultar', 'crear', 'editar', 'eliminar'];

function fail(message: string): never {
  throw new Error(message);
}

function object(value: unknown, name: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    fail(`${name} inválido.`);
  return value as JsonObject;
}

function only(value: JsonObject, allowed: readonly string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail('Campo desconocido.');
}

function id(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 140 && /^[A-Za-z0-9_-]+$/.test(value);
}

function actionId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 142 && /^[A-Za-z0-9_-]+:[0-4]$/.test(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 140;
}

function money(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 100_000_000;
}

function timestamp(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 8_640_000_000_000_000
  );
}

function optional(value: unknown, check: (item: unknown) => boolean): boolean {
  return value === undefined || check(value);
}

function validateNeedsAreMissing(
  needsInput: readonly string[],
  payload: JsonObject,
  resourceId: unknown
): void {
  if (
    needsInput.some((field) =>
      field === 'resourceId' ? resourceId !== undefined : payload[field] !== undefined
    )
  )
    fail('needsInput inválido.');
}

function validatePayload(
  domain: string,
  operation: string,
  payload: JsonObject,
  needsInput: readonly string[] = []
): string[] {
  if (operation === 'eliminar' || (domain === 'meta' && operation === 'consultar')) {
    only(payload, []);
    return [];
  }
  if (operation === 'consultar') {
    const allowed =
      domain === 'movimiento' ? ['desde', 'hasta', 'tipo'] : ['desde', 'hasta', 'goalId', 'type'];
    only(payload, allowed);
    if (
      !optional(payload.desde, timestamp) ||
      !optional(payload.hasta, timestamp) ||
      (payload.desde !== undefined &&
        payload.hasta !== undefined &&
        Number(payload.desde) > Number(payload.hasta)) ||
      (domain === 'movimiento' &&
        !optional(payload.tipo, (x) => x === 'gasto' || x === 'ahorro')) ||
      (domain === 'ahorro' &&
        (!optional(payload.goalId, id) ||
          !optional(payload.type, (x) => x === 'aporte' || x === 'retiro')))
    )
      fail('Consulta inválida.');
    return allowed;
  }

  const rules =
    domain === 'movimiento'
      ? {
          allowed: ['tipo', 'monto', 'descripcion', 'categoria', 'fecha', 'goalId'],
          required: ['tipo', 'monto', 'descripcion', 'categoria', 'fecha'],
          valid:
            optional(payload.tipo, (x) => x === 'gasto' || x === 'ahorro') &&
            optional(payload.monto, money) &&
            optional(payload.descripcion, text) &&
            optional(payload.categoria, (x) =>
              MOVIMIENTO_CATEGORIAS.includes(x as MovimientoCategoria)
            ) &&
            optional(payload.fecha, timestamp) &&
            optional(payload.goalId, id),
        }
      : domain === 'ahorro'
        ? {
            allowed: ['type', 'amount', 'description', 'goalId', 'fecha'],
            required: ['type', 'amount', 'description', 'fecha'],
            valid:
              optional(payload.type, (x) => x === 'aporte' || x === 'retiro') &&
              optional(payload.amount, money) &&
              optional(payload.description, text) &&
              optional(payload.goalId, id) &&
              optional(payload.fecha, timestamp),
          }
        : {
            allowed: ['title', 'iconId', 'category', 'targetAmount', 'deadline'],
            required: ['title', 'iconId', 'category', 'targetAmount'],
            valid:
              optional(payload.title, text) &&
              optional(payload.iconId, (x) => ICONS.includes(String(x))) &&
              optional(payload.category, (x) => GOAL_CATEGORIES.includes(String(x))) &&
              optional(payload.targetAmount, money) &&
              optional(payload.deadline, timestamp),
          };
  only(payload, rules.allowed);
  if (
    !rules.valid ||
    (operation === 'crear' &&
      rules.required.some((key) => payload[key] === undefined && !needsInput.includes(key))) ||
    (operation === 'editar' &&
      Object.keys(payload).length === 0 &&
      !needsInput.some((field) => field !== 'resourceId'))
  )
    fail('Payload inválido.');
  return rules.allowed;
}

function allowedNeedsInput(domain: string, operation: string): string[] {
  if (domain === 'movimiento') {
    if (operation === 'consultar') return ['desde', 'hasta', 'tipo'];
    if (operation === 'crear')
      return ['tipo', 'monto', 'descripcion', 'categoria', 'fecha', 'goalId'];
    if (operation === 'editar')
      return ['resourceId', 'tipo', 'monto', 'descripcion', 'categoria', 'fecha', 'goalId'];
    return ['resourceId'];
  }
  if (domain === 'ahorro') {
    if (operation === 'consultar') return ['desde', 'hasta', 'goalId', 'type'];
    if (operation === 'crear') return ['type', 'amount', 'description', 'goalId', 'fecha'];
    if (operation === 'editar')
      return ['resourceId', 'type', 'amount', 'description', 'goalId', 'fecha'];
    return ['resourceId'];
  }
  if (operation === 'consultar' || operation === 'eliminar') return ['resourceId'];
  if (operation === 'crear') return ['title', 'iconId', 'category', 'targetAmount', 'deadline'];
  return ['resourceId', 'title', 'iconId', 'category', 'targetAmount', 'deadline'];
}

function parseAction(value: unknown): FinancialAction {
  const action = object(value, 'Acción');
  only(action, ['actionId', 'domain', 'operation', 'resourceId', 'payload', 'needsInput']);
  if (!actionId(action.actionId)) fail('actionId inválido.');
  if (action.domain !== 'movimiento' && action.domain !== 'ahorro' && action.domain !== 'meta')
    fail('Dominio inválido.');
  if (!OPERATIONS.includes(String(action.operation))) fail('Operación inválida.');
  const operation = action.operation as FinancialAction['operation'];
  const needsInput = action.needsInput;
  if (
    !Array.isArray(needsInput) ||
    needsInput.length > 5 ||
    new Set(needsInput).size !== needsInput.length ||
    !needsInput.every(
      (field) =>
        typeof field === 'string' &&
        allowedNeedsInput(action.domain as string, operation).includes(field)
    )
  )
    fail('needsInput inválido.');
  const needsResource = operation === 'editar' || operation === 'eliminar';
  const allowsResource = needsResource || (action.domain === 'meta' && operation === 'consultar');
  if (
    (needsResource && !id(action.resourceId) && !needsInput.includes('resourceId')) ||
    (!allowsResource && action.resourceId !== undefined) ||
    (action.resourceId !== undefined && !id(action.resourceId))
  )
    fail('resourceId inválido.');
  const payload = object(action.payload, 'Payload');
  validateNeedsAreMissing(needsInput, payload, action.resourceId);
  validatePayload(action.domain, operation, payload, needsInput);
  return {
    actionId: action.actionId,
    domain: action.domain,
    operation,
    ...(action.resourceId === undefined ? {} : { resourceId: action.resourceId as string }),
    payload,
    needsInput,
  } as FinancialAction;
}

export function parseClientFinancialPlan(value: unknown): FinancialPlan {
  const plan = object(value, 'Plan');
  only(plan, ['actions']);
  if (!Array.isArray(plan.actions) || plan.actions.length < 1 || plan.actions.length > 5)
    fail('Plan inválido.');
  return { actions: plan.actions.map(parseAction), source: 'remote' };
}

export function buildFinancialContext(
  movements: Movimiento[],
  goals: SavingsGoal[],
  operations: SavingsOperation[]
): FinancialContext {
  const recent = [
    ...movements.map((value) => ({
      kind: 'movement' as const,
      date: value.updatedAt ?? value.fecha ?? value.createdAt,
      value,
    })),
    ...goals
      .filter((goal) => !goal.deletedAt)
      .map((value) => ({ kind: 'goal' as const, date: value.updatedAt, value })),
    ...operations.map((value) => ({ kind: 'operation' as const, date: value.updatedAt, value })),
  ]
    .sort((a, b) => b.date - a.date)
    .slice(0, 30);
  return {
    goals: recent
      .filter((item) => item.kind === 'goal')
      .map(({ value }) => ({ id: value.id, title: value.title, targetAmount: value.targetAmount })),
    movements: recent
      .filter((item) => item.kind === 'movement')
      .map(({ value }) => ({
        id: value.id,
        tipo: value.tipo,
        monto: value.monto,
        descripcion: value.descripcion,
        categoria: value.categoria,
        fecha: value.fecha ?? value.createdAt,
        ...(value.goalId ? { goalId: value.goalId } : {}),
      })),
    operations: recent
      .filter((item) => item.kind === 'operation')
      .map(({ value }) => ({
        id: value.id,
        type: value.type,
        amount: value.amount,
        description: value.description,
        fecha: value.fecha,
        ...(value.goalId ? { goalId: value.goalId } : {}),
      })),
  };
}
