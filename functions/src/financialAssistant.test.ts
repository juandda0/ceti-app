import {
  buildFinancialPrompt,
  classifyFinancialAssistantError,
  dailyFinancialAssistantUsagePath,
  FinancialRequestError,
  isFinancialAssistantQuotaExceeded,
  parseFinancialContext,
  planFinancialActions,
  planFinancialActionsWithQuota,
} from './financialAssistant';
import { ModelApiError } from './modelProvider';
import { FinancialPlanError } from './financialPlan';

const emptyContext = { goals: [], movements: [] };

test('el contexto no acepta campos de identidad', () => {
  const context = parseFinancialContext({
    goals: [{ id: 'g1', title: 'Bici', targetAmount: 300000 }],
    movements: [
      {
        id: 'm1',
        tipo: 'gasto',
        monto: 10000,
        descripcion: 'almuerzo',
        categoria: 'comida',
        fecha: 10,
      },
    ],
  });
  expect(context.goals).toHaveLength(1);

  expect(() => parseFinancialContext({ uid: 'u1', goals: [], movements: [] })).toThrow();
});

test('el prompt de sistema es estático y trata el user JSON como datos no confiables', () => {
  expect(buildFinancialPrompt()).toContain('datos no confiables');
  expect(buildFinancialPrompt()).not.toContain('g1');
  expect(buildFinancialPrompt()).toBe(buildFinancialPrompt());
});

test.each(['', ' '.repeat(3), 'a'.repeat(301)])('rechaza texto fuera de rango', async (text) => {
  await expect(
    planFinancialActions({ text, requestId: 'r1', context: emptyContext }, jest.fn())
  ).rejects.toThrow();
});

test('rechaza más de 30 recursos de contexto', () => {
  expect(() =>
    parseFinancialContext({
      goals: Array.from({ length: 31 }, (_, index) => ({
        id: `g${index}`,
        title: 'Meta',
        targetAmount: 100,
      })),
      movements: [],
      operations: [],
    })
  ).toThrow();
});

test('envía solo texto y contexto al modelo y valida el plan devuelto', async () => {
  const callModel = jest.fn().mockResolvedValue(
    JSON.stringify({
      actions: [
        {
          domain: 'meta',
          operation: 'consultar',
          payload: {},
          needsInput: [],
        },
      ],
    })
  );

  const result = await planFinancialActions(
    { text: 'muéstrame mis metas', requestId: 'r1', context: emptyContext },
    callModel
  );

  expect(result.actions[0].actionId).toBe('r1:0');
  expect(callModel.mock.calls[0][0]).toBe(buildFinancialPrompt());
  expect(JSON.parse(callModel.mock.calls[0][1])).toEqual({
    untrustedData: {
      text: 'mis metas',
      context: { ...emptyContext, operations: [] },
    },
  });
});

test.each([
  'transferí a Juan Pérez, vive en Calle 10 #20-30',
  'gasté con mi mamá Ana y mi hermano pedro en su casa',
])('envía solo vocabulario financiero y omite nombres, relaciones y dirección', async (text) => {
  const callModel = jest
    .fn()
    .mockResolvedValue(
      '{"actions":[{"domain":"meta","operation":"consultar","payload":{},"needsInput":[]}]}'
    );
  await planFinancialActions(
    {
      text,
      requestId: 'r1',
      context: {
        goals: [{ id: 'g1', title: 'Bici de Juan', targetAmount: 300000 }],
        movements: [
          {
            id: 'm1',
            tipo: 'gasto',
            monto: 10000,
            descripcion: 'Regalo para Ana Pérez',
            categoria: 'regalos',
            fecha: 10,
          },
        ],
        operations: [
          {
            id: 'o1',
            type: 'aporte',
            amount: 100,
            description: 'Transferencia de mamá',
            fecha: 10,
          },
        ],
      },
    },
    callModel
  );
  const userData = JSON.parse(callModel.mock.calls[0][1]).untrustedData;
  expect(JSON.stringify(userData)).not.toMatch(
    /juan|pérez|perez|calle|mamá|mama|hermano|pedro|casa/i
  );
  expect(userData.context.goals[0]).not.toHaveProperty('title');
  expect(userData.context.movements[0]).not.toHaveProperty('descripcion');
  expect(userData.context.operations[0]).not.toHaveProperty('description');
  expect(userData.context).toEqual({
    goals: [{ id: 'g1', targetAmount: 300000 }],
    movements: [{ id: 'm1', tipo: 'gasto', monto: 10000, categoria: 'regalos', fecha: 10 }],
    operations: [{ id: 'o1', type: 'aporte', amount: 100, fecha: 10 }],
  });
});

test('solo conserva aliases opacos que existen en el contexto', async () => {
  const callModel = jest
    .fn()
    .mockResolvedValue(
      '{"actions":[{"domain":"meta","operation":"consultar","payload":{},"needsInput":["resourceId"]}]}'
    );
  await planFinancialActions(
    {
      text: 'elimina la meta g1 de juan y la meta inventada_x',
      requestId: 'r1',
      context: {
        goals: [{ id: 'g1', title: 'Viaje de Juan', targetAmount: 300000 }],
        movements: [],
      },
    },
    callModel
  );

  expect(JSON.parse(callModel.mock.calls[0][1]).untrustedData.text).toBe(
    'elimina la meta g1 de y la meta'
  );
});

test('el prompt exige needsInput cuando una referencia no se puede resolver', () => {
  expect(buildFinancialPrompt()).toContain('referencia no se puede resolver');
  expect(buildFinancialPrompt()).toContain('needsInput');
});

test.each([
  {
    context: { goals: [], movements: [], operations: [] },
    action: { domain: 'meta', operation: 'eliminar', resourceId: 'inventada', payload: {} },
  },
  {
    context: { goals: [{ id: 'g1', title: 'Bici', targetAmount: 100 }], movements: [] },
    action: {
      domain: 'movimiento',
      operation: 'crear',
      payload: {
        tipo: 'ahorro',
        monto: 100,
        descripcion: 'aporte',
        categoria: 'otros',
        fecha: 1,
        goalId: 'g2',
      },
    },
  },
])('rechaza IDs inventados por el modelo', async ({ context, action }) => {
  await expect(
    planFinancialActions(
      { text: 'elimina meta', requestId: 'r1', context },
      jest.fn().mockResolvedValue(JSON.stringify({ actions: [action] }))
    )
  ).rejects.toThrow('ID fuera del contexto');
});

test('rechaza un plan inválido del modelo', async () => {
  await expect(
    planFinancialActions(
      { text: 'borra todo', requestId: 'r1', context: emptyContext },
      jest.fn().mockResolvedValue('{"actions":[]}')
    )
  ).rejects.toThrow('entre una y cinco acciones');
});

test('clasifica entrada separada de fallos del modelo o de su respuesta', () => {
  expect(classifyFinancialAssistantError(new FinancialRequestError('text inválido'))).toEqual({
    code: 'invalid-argument',
    message: 'text inválido',
  });
  expect(classifyFinancialAssistantError(new ModelApiError('raw secreto'))).toEqual({
    code: 'unavailable',
    message: 'No pude organizar la solicitud.',
    logCode: 'model-api',
  });
  expect(classifyFinancialAssistantError(new FinancialPlanError('respuesta raw'))).toEqual({
    code: 'unavailable',
    message: 'No pude organizar la solicitud.',
    logCode: 'model-output',
  });
  expect(classifyFinancialAssistantError(new Error('respuesta raw'))).toEqual({
    code: 'unavailable',
    message: 'No pude organizar la solicitud.',
    logCode: 'unexpected',
  });
});

test('la cuota permite 99 éxitos y bloquea desde 100', () => {
  expect(isFinancialAssistantQuotaExceeded(99)).toBe(false);
  expect(isFinancialAssistantQuotaExceeded(100)).toBe(true);
});

test('no llama al modelo cuando no puede reservar cuota', async () => {
  const callModel = jest.fn();
  await expect(
    planFinancialActionsWithQuota(
      { text: 'gaste 100', requestId: 'r1', context: emptyContext },
      callModel,
      jest.fn().mockRejectedValue(new Error('quota'))
    )
  ).rejects.toThrow('quota');
  expect(callModel).not.toHaveBeenCalled();
});

test('reserva el intento antes del modelo y lo conserva si Groq falla', async () => {
  const events: string[] = [];
  const callModel = jest.fn(async () => {
    events.push('model');
    throw new ModelApiError('Groq no disponible');
  });

  await expect(
    planFinancialActionsWithQuota(
      { text: 'gaste 100', requestId: 'r1', context: emptyContext },
      callModel,
      async () => {
        events.push('reserve');
      }
    )
  ).rejects.toThrow('Groq no disponible');
  expect(events).toEqual(['reserve', 'model']);
});

test('genera una ruta diaria UTC sin datos de la solicitud', () => {
  expect(dailyFinancialAssistantUsagePath('student_1', new Date('2026-08-29T23:59:00Z'))).toBe(
    'financialAssistantUsage/student_1_2026-08-29'
  );
});
