export const MOVIMIENTO_CATEGORIAS = [
  'comida',
  'transporte',
  'entretenimiento',
  'ropa',
  'educacion',
  'tecnologia',
  'regalos',
  'otros',
] as const;

export type MovimientoCategoria = (typeof MOVIMIENTO_CATEGORIAS)[number];

type MovementChanges = Partial<{
  tipo: 'gasto' | 'ahorro';
  monto: number;
  descripcion: string;
  categoria: MovimientoCategoria;
  fecha: number;
  goalId: string;
}>;
type SavingsPayload = {
  type: 'aporte' | 'retiro';
  amount: number;
  description: string;
  goalId?: string;
  fecha: number;
};
type SavingsChanges = Partial<SavingsPayload>;
type GoalPayload = {
  title: string;
  iconId: 'bike' | 'book' | 'laptop' | 'plane' | 'shield' | 'target';
  category: 'electronics' | 'toy' | 'trip' | 'education' | 'emergency' | 'custom';
  targetAmount: number;
  deadline?: number;
};
type GoalChanges = Partial<GoalPayload>;

export type FinancialAction =
  | {
      actionId: string;
      domain: 'movimiento';
      operation: 'consultar';
      payload: { desde?: number; hasta?: number; tipo?: 'gasto' | 'ahorro' };
      needsInput: string[];
    }
  | {
      actionId: string;
      domain: 'movimiento';
      operation: 'crear';
      payload: MovementChanges;
      needsInput: string[];
    }
  | {
      actionId: string;
      domain: 'movimiento';
      operation: 'editar' | 'eliminar';
      resourceId?: string;
      payload: MovementChanges;
      needsInput: string[];
    }
  | {
      actionId: string;
      domain: 'ahorro';
      operation: 'consultar';
      payload: { desde?: number; hasta?: number; goalId?: string; type?: 'aporte' | 'retiro' };
      needsInput: string[];
    }
  | {
      actionId: string;
      domain: 'ahorro';
      operation: 'crear';
      payload: SavingsChanges;
      needsInput: string[];
    }
  | {
      actionId: string;
      domain: 'ahorro';
      operation: 'editar';
      resourceId?: string;
      payload: SavingsChanges;
      needsInput: string[];
    }
  | {
      actionId: string;
      domain: 'ahorro';
      operation: 'eliminar';
      resourceId?: string;
      payload: Record<string, never>;
      needsInput: string[];
    }
  | {
      actionId: string;
      domain: 'meta';
      operation: 'consultar';
      payload: Record<string, never>;
      needsInput: string[];
    }
  | {
      actionId: string;
      domain: 'meta';
      operation: 'crear';
      payload: GoalChanges;
      needsInput: string[];
    }
  | {
      actionId: string;
      domain: 'meta';
      operation: 'editar';
      resourceId?: string;
      payload: GoalChanges;
      needsInput: string[];
    }
  | {
      actionId: string;
      domain: 'meta';
      operation: 'eliminar';
      resourceId?: string;
      payload: Record<string, never>;
      needsInput: string[];
    };

export interface FinancialPlan {
  actions: FinancialAction[];
}

export class FinancialPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinancialPlanError';
  }
}

type JsonObject = Record<string, unknown>;

const GOAL_ICON_IDS = ['bike', 'book', 'laptop', 'plane', 'shield', 'target'] as const;
const GOAL_CATEGORIES = ['electronics', 'toy', 'trip', 'education', 'emergency', 'custom'] as const;

function invalid(message: string): never {
  throw new FinancialPlanError(message);
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, name: string): JsonObject {
  return isObject(value) ? value : invalid(`${name} debe ser un objeto.`);
}

function requireOnly(value: JsonObject, allowed: readonly string[], name: string): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    invalid(`${name} contiene campos adicionales.`);
  }
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 140;
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 140 && /^[A-Za-z0-9_-]+$/.test(value);
}

function isMoney(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 100_000_000;
}

function isTimestamp(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 8_640_000_000_000_000
  );
}

function optional(value: unknown, predicate: (item: unknown) => boolean): boolean {
  return value === undefined || predicate(value);
}

function validateNeedsInput(value: unknown, allowed: readonly string[]): string[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > 5 ||
    !value.every((item) => typeof item === 'string' && allowed.includes(item)) ||
    new Set(value).size !== value.length
  )
    invalid('needsInput es inválido.');
  return value;
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
    invalid('needsInput debe contener únicamente campos ausentes.');
}

function validateRange(payload: JsonObject): void {
  if (
    payload.desde !== undefined &&
    payload.hasta !== undefined &&
    Number(payload.desde) > Number(payload.hasta)
  )
    invalid('El rango de fechas es inválido.');
}

function validateMovementPayload(
  operation: string,
  payload: JsonObject,
  needsInput: readonly string[] = []
): void {
  if (operation === 'consultar') {
    requireOnly(payload, ['desde', 'hasta', 'tipo'], 'payload');
    if (
      !optional(payload.desde, isTimestamp) ||
      !optional(payload.hasta, isTimestamp) ||
      !optional(payload.tipo, (value) => value === 'gasto' || value === 'ahorro')
    )
      invalid('Consulta de movimientos inválida.');
    validateRange(payload);
    return;
  }
  if (operation === 'eliminar') {
    requireOnly(payload, [], 'payload');
    return;
  }
  requireOnly(payload, ['tipo', 'monto', 'descripcion', 'categoria', 'fecha', 'goalId'], 'payload');
  const fieldsAreValid =
    optional(payload.tipo, (value) => value === 'gasto' || value === 'ahorro') &&
    optional(payload.monto, isMoney) &&
    optional(payload.descripcion, isText) &&
    optional(payload.categoria, (value) =>
      MOVIMIENTO_CATEGORIAS.includes(value as MovimientoCategoria)
    ) &&
    optional(payload.fecha, isTimestamp) &&
    optional(payload.goalId, isId);
  const requiredForCreate =
    operation !== 'crear' ||
    ['tipo', 'monto', 'descripcion', 'categoria', 'fecha'].every(
      (field) => payload[field] !== undefined || needsInput.includes(field)
    );
  if (
    !fieldsAreValid ||
    !requiredForCreate ||
    (operation === 'editar' &&
      Object.keys(payload).length === 0 &&
      !needsInput.some((field) => field !== 'resourceId'))
  ) {
    invalid('Payload de movimiento inválido.');
  }
}

function validateMovementQueryPayload(
  payload: JsonObject
): asserts payload is { desde?: number; hasta?: number; tipo?: 'gasto' | 'ahorro' } {
  validateMovementPayload('consultar', payload);
}

function validateMovementCreatePayload(
  payload: JsonObject,
  needsInput: readonly string[]
): asserts payload is MovementChanges {
  validateMovementPayload('crear', payload, needsInput);
}

function validateMovementChanges(
  payload: JsonObject,
  needsInput: readonly string[]
): asserts payload is MovementChanges {
  validateMovementPayload('editar', payload, needsInput);
}

function validateSavingsPayload(
  operation: string,
  payload: JsonObject,
  needsInput: readonly string[] = []
): void {
  if (operation === 'consultar') {
    requireOnly(payload, ['desde', 'hasta', 'goalId', 'type'], 'payload');
    if (
      !optional(payload.desde, isTimestamp) ||
      !optional(payload.hasta, isTimestamp) ||
      !optional(payload.goalId, isId) ||
      !optional(payload.type, (value) => value === 'aporte' || value === 'retiro')
    )
      invalid('Consulta de ahorros inválida.');
    validateRange(payload);
    return;
  }
  if (operation === 'eliminar') {
    requireOnly(payload, [], 'payload');
    return;
  }
  requireOnly(payload, ['type', 'amount', 'description', 'goalId', 'fecha'], 'payload');
  const fieldsAreValid =
    optional(payload.type, (value) => value === 'aporte' || value === 'retiro') &&
    optional(payload.amount, isMoney) &&
    optional(payload.description, isText) &&
    optional(payload.goalId, isId) &&
    optional(payload.fecha, isTimestamp);
  const requiredForCreate =
    operation !== 'crear' ||
    ['type', 'amount', 'description', 'fecha'].every(
      (field) => payload[field] !== undefined || needsInput.includes(field)
    );
  if (
    !fieldsAreValid ||
    !requiredForCreate ||
    (operation === 'editar' &&
      Object.keys(payload).length === 0 &&
      !needsInput.some((field) => field !== 'resourceId'))
  ) {
    invalid('Payload de ahorro inválido.');
  }
}

function validateSavingsQueryPayload(payload: JsonObject): asserts payload is {
  desde?: number;
  hasta?: number;
  goalId?: string;
  type?: 'aporte' | 'retiro';
} {
  validateSavingsPayload('consultar', payload);
}

function validateSavingsCreatePayload(
  payload: JsonObject,
  needsInput: readonly string[]
): asserts payload is SavingsChanges {
  validateSavingsPayload('crear', payload, needsInput);
}

function validateSavingsChanges(
  payload: JsonObject,
  needsInput: readonly string[]
): asserts payload is SavingsChanges {
  validateSavingsPayload('editar', payload, needsInput);
}

function validateGoalPayload(
  operation: string,
  payload: JsonObject,
  needsInput: readonly string[] = []
): void {
  if (operation === 'consultar' || operation === 'eliminar') {
    requireOnly(payload, [], 'payload');
    return;
  }
  requireOnly(payload, ['title', 'iconId', 'category', 'targetAmount', 'deadline'], 'payload');
  const fieldsAreValid =
    optional(payload.title, isText) &&
    optional(payload.iconId, (value) =>
      GOAL_ICON_IDS.includes(value as (typeof GOAL_ICON_IDS)[number])
    ) &&
    optional(payload.category, (value) =>
      GOAL_CATEGORIES.includes(value as (typeof GOAL_CATEGORIES)[number])
    ) &&
    optional(payload.targetAmount, isMoney) &&
    optional(payload.deadline, isTimestamp);
  const requiredForCreate =
    operation !== 'crear' ||
    ['title', 'iconId', 'category', 'targetAmount'].every(
      (field) => payload[field] !== undefined || needsInput.includes(field)
    );
  if (
    !fieldsAreValid ||
    !requiredForCreate ||
    (operation === 'editar' &&
      Object.keys(payload).length === 0 &&
      !needsInput.some((field) => field !== 'resourceId'))
  ) {
    invalid('Payload de meta inválido.');
  }
}

function validateGoalCreatePayload(
  payload: JsonObject,
  needsInput: readonly string[]
): asserts payload is GoalChanges {
  validateGoalPayload('crear', payload, needsInput);
}

function validateGoalChanges(
  payload: JsonObject,
  needsInput: readonly string[]
): asserts payload is GoalChanges {
  validateGoalPayload('editar', payload, needsInput);
}

function validateEmptyPayload(payload: JsonObject): asserts payload is Record<string, never> {
  requireOnly(payload, [], 'payload');
}

function parseAction(value: unknown, actionId: string): FinancialAction {
  const action = requireObject(value, 'La acción');
  requireOnly(action, ['domain', 'operation', 'resourceId', 'payload', 'needsInput'], 'La acción');
  if (action.domain !== 'movimiento' && action.domain !== 'ahorro' && action.domain !== 'meta')
    invalid('Dominio inválido.');
  if (
    action.operation !== 'consultar' &&
    action.operation !== 'crear' &&
    action.operation !== 'editar' &&
    action.operation !== 'eliminar'
  )
    invalid('Operación inválida.');
  const resourceId = action.resourceId;
  if (resourceId !== undefined && !isId(resourceId)) invalid('resourceId inválido.');

  const payload = requireObject(action.payload, 'payload');

  if (action.domain === 'movimiento') {
    if (action.operation === 'consultar') {
      if (resourceId !== undefined) invalid('La consulta no admite resourceId.');
      validateMovementQueryPayload(payload);
      const needsInput = validateNeedsInput(action.needsInput, ['desde', 'hasta', 'tipo']);
      validateNeedsAreMissing(needsInput, payload, resourceId);
      return { actionId, domain: 'movimiento', operation: 'consultar', payload, needsInput };
    }
    if (action.operation === 'crear') {
      if (resourceId !== undefined) invalid('La creación no admite resourceId.');
      const needsInput = validateNeedsInput(action.needsInput, [
        'tipo',
        'monto',
        'descripcion',
        'categoria',
        'fecha',
        'goalId',
      ]);
      validateNeedsAreMissing(needsInput, payload, resourceId);
      validateMovementCreatePayload(payload, needsInput);
      return { actionId, domain: 'movimiento', operation: 'crear', payload, needsInput };
    }
    const needsInput = validateNeedsInput(
      action.needsInput,
      action.operation === 'editar'
        ? ['resourceId', 'tipo', 'monto', 'descripcion', 'categoria', 'fecha', 'goalId']
        : ['resourceId']
    );
    validateNeedsAreMissing(needsInput, payload, resourceId);
    if (!isId(resourceId) && !needsInput.includes('resourceId'))
      invalid('La operación requiere resourceId.');
    if (action.operation === 'editar') validateMovementChanges(payload, needsInput);
    else validateEmptyPayload(payload);
    return {
      actionId,
      domain: 'movimiento',
      operation: action.operation,
      ...(resourceId === undefined ? {} : { resourceId }),
      payload,
      needsInput,
    };
  }
  if (action.domain === 'ahorro') {
    if (action.operation === 'consultar') {
      if (resourceId !== undefined) invalid('La consulta no admite resourceId.');
      validateSavingsQueryPayload(payload);
      const needsInput = validateNeedsInput(action.needsInput, [
        'desde',
        'hasta',
        'goalId',
        'type',
      ]);
      validateNeedsAreMissing(needsInput, payload, resourceId);
      return { actionId, domain: 'ahorro', operation: 'consultar', payload, needsInput };
    }
    if (action.operation === 'crear') {
      if (resourceId !== undefined) invalid('La creación no admite resourceId.');
      const needsInput = validateNeedsInput(action.needsInput, [
        'type',
        'amount',
        'description',
        'goalId',
        'fecha',
      ]);
      validateNeedsAreMissing(needsInput, payload, resourceId);
      validateSavingsCreatePayload(payload, needsInput);
      return { actionId, domain: 'ahorro', operation: 'crear', payload, needsInput };
    }
    const needsInput = validateNeedsInput(
      action.needsInput,
      action.operation === 'editar'
        ? ['resourceId', 'type', 'amount', 'description', 'goalId', 'fecha']
        : ['resourceId']
    );
    validateNeedsAreMissing(needsInput, payload, resourceId);
    if (!isId(resourceId) && !needsInput.includes('resourceId'))
      invalid('La operación requiere resourceId.');
    if (action.operation === 'editar') {
      validateSavingsChanges(payload, needsInput);
      return {
        actionId,
        domain: 'ahorro',
        operation: 'editar',
        ...(resourceId === undefined ? {} : { resourceId }),
        payload,
        needsInput,
      };
    }
    validateEmptyPayload(payload);
    return {
      actionId,
      domain: 'ahorro',
      operation: 'eliminar',
      ...(resourceId === undefined ? {} : { resourceId }),
      payload,
      needsInput,
    };
  }
  if (action.operation === 'consultar') {
    validateEmptyPayload(payload);
    const needsInput = validateNeedsInput(action.needsInput, ['resourceId']);
    validateNeedsAreMissing(needsInput, payload, resourceId);
    return {
      actionId,
      domain: 'meta',
      operation: 'consultar',
      ...(resourceId === undefined ? {} : { resourceId }),
      payload,
      needsInput,
    };
  }
  if (action.operation === 'crear') {
    if (resourceId !== undefined) invalid('La creación no admite resourceId.');
    const needsInput = validateNeedsInput(action.needsInput, [
      'title',
      'iconId',
      'category',
      'targetAmount',
      'deadline',
    ]);
    validateNeedsAreMissing(needsInput, payload, resourceId);
    validateGoalCreatePayload(payload, needsInput);
    return { actionId, domain: 'meta', operation: 'crear', payload, needsInput };
  }
  const needsInput = validateNeedsInput(
    action.needsInput,
    action.operation === 'editar'
      ? ['resourceId', 'title', 'iconId', 'category', 'targetAmount', 'deadline']
      : ['resourceId']
  );
  validateNeedsAreMissing(needsInput, payload, resourceId);
  if (!isId(resourceId) && !needsInput.includes('resourceId'))
    invalid('La operación requiere resourceId.');
  if (action.operation === 'editar') {
    validateGoalChanges(payload, needsInput);
    return {
      actionId,
      domain: 'meta',
      operation: 'editar',
      ...(resourceId === undefined ? {} : { resourceId }),
      payload,
      needsInput,
    };
  }
  validateEmptyPayload(payload);
  return {
    actionId,
    domain: 'meta',
    operation: 'eliminar',
    ...(resourceId === undefined ? {} : { resourceId }),
    payload,
    needsInput,
  };
}

export function parseFinancialPlan(raw: string, requestId: string): FinancialPlan {
  if (!isId(requestId)) invalid('requestId inválido.');
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    invalid('La respuesta no contiene JSON válido.');
  }
  const plan = requireObject(decoded, 'El plan');
  requireOnly(plan, ['actions'], 'El plan');
  if (!Array.isArray(plan.actions) || plan.actions.length < 1 || plan.actions.length > 5) {
    invalid('El plan debe contener entre una y cinco acciones.');
  }
  return {
    actions: plan.actions.map((action, index) => parseAction(action, `${requestId}:${index}`)),
  };
}
