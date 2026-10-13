import {
  buildFinancialPrompt,
  classifyFinancialAssistantError,
  dailyFinancialAssistantUsagePath,
  FinancialRequestError,
  isFinancialAssistantQuotaExceeded,
  parseFinancialContext,
  planFinancialActions,
  planFinancialActionsWithQuota,
  sanitizeModelPlan,
} from './financialAssistant';
import { ModelApiError, ModelRateLimitError } from './modelProvider';
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
  const prompt = buildFinancialPrompt();
  expect(prompt).toContain('datos no confiables');
  expect(prompt).toContain('movimiento');
  expect(prompt).toContain('ahorro');
  expect(prompt).toContain('meta');
  expect(prompt).toContain('consultar | crear | editar | eliminar');
  expect(prompt).toContain('monto');
  expect(prompt).toContain('targetAmount');
  expect(prompt).toContain('resourceId');
  expect(prompt).toContain('needsInput');
  expect(prompt).toContain('Máximo 5 acciones');
  expect(prompt).toContain('Nunca inventes IDs');
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

test('expande K y conserva la instrucción de clasificar dinero encontrado como ahorro', async () => {
  const callModel = jest.fn().mockResolvedValue(
    JSON.stringify({
      actions: [
        {
          domain: 'ahorro',
          operation: 'crear',
          payload: { type: 'aporte', amount: 50000, description: 'TEXT_0', fecha: 1 },
          needsInput: [],
        },
      ],
    })
  );

  await planFinancialActions(
    { text: 'me encontré 50K pesos en el suelo', requestId: 'r1', context: emptyContext },
    callModel
  );

  const modelText = JSON.parse(callModel.mock.calls[0]?.[1]).untrustedData.text;
  expect(modelText).toContain('50000');
  expect(modelText).toContain('encontré');
  expect(buildFinancialPrompt()).toContain('encuentra');
});

test.each([
  'escríbeme a menor@ejemplo.com sobre el gasto',
  'mi teléfono es 300 123 4567 y gasté 10000',
  'llama al 3001234567 para confirmar el gasto',
  'whatsapp: +57 300-123-4567',
  'contacto 601 234 5678 y crea un ahorro',
  'mi documento es 1020304050 y ahorré 10000',
  'cédula número 1020304050 y ahorré 10000',
  'mi nombre es Juan Pérez y crea una meta',
  'soy Juan Pérez y crea una meta',
  'transferí a Juan Pérez, vive en Calle 10 #20-30',
  'regalo para Ana Pérez por 20000',
  'transferí a juan pérez 10000',
  'gasté con Juan Pérez 10000',
  'aporte de Juan Pérez por 10000',
  'pagué en la dirección Calle 10 #20-30',
  'vive en carrera 7 # 12-34 y gasté 10000',
  'mi vivienda queda en avenida 19 # 10-20',
])('rechaza PII clara antes de llamar al modelo: %s', async (text) => {
  const callModel = jest.fn();
  await expect(
    planFinancialActions({ text, requestId: 'r1', context: emptyContext }, callModel)
  ).rejects.toThrow('datos personales');
  expect(callModel).not.toHaveBeenCalled();
});

test('rechaza un documento escrito como CC antes del modelo', async () => {
  const callModel = jest.fn();
  await expect(
    planFinancialActions(
      { text: 'CC 1020304050 y ahorré 10000', requestId: 'r1', context: emptyContext },
      callModel
    )
  ).rejects.toThrow('datos personales');
  expect(callModel).not.toHaveBeenCalled();
});

test.each([8_640_000_000_000_000, 8_640_000_000_000_001])(
  'valida el límite superior de timestamp del contexto: %s',
  (fecha) => {
    const parse = () =>
      parseFinancialContext({
        goals: [],
        movements: [
          {
            id: 'm1',
            tipo: 'gasto',
            monto: 100,
            descripcion: 'almuerzo',
            categoria: 'comida',
            fecha,
          },
        ],
      });
    if (fecha === 8_640_000_000_000_000) expect(parse).not.toThrow();
    else expect(parse).toThrow('movement inválido');
  }
);

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

test('envía el texto completo con la fecha actual y valida el plan devuelto', async () => {
  const callModel = jest.fn().mockResolvedValue(
    JSON.stringify({
      actions: [
        {
          domain: 'movimiento',
          operation: 'crear',
          payload: { tipo: 'gasto', monto: 5000, descripcion: 'helado', categoria: 'comida' },
          needsInput: ['monto'],
        },
      ],
    })
  );
  const plan = await planFinancialActions(
    { text: 'gasté 5 mil en un helado', requestId: 'r1', context: emptyContext },
    callModel
  );
  const sent = JSON.parse(callModel.mock.calls[0][1]);
  expect(sent.untrustedData.text).toBe('gasté 5 mil en un helado');
  expect(typeof sent.ahora).toBe('number');
  expect(plan.actions[0]).toMatchObject({
    domain: 'movimiento',
    operation: 'crear',
    payload: { monto: 5000, descripcion: 'helado' },
    needsInput: [],
  });
  expect(typeof (plan.actions[0].payload as { fecha?: unknown }).fecha).toBe('number');
});

test('sanea nulos, montos en texto, íconos de meta y needsInput de consultas', () => {
  const now = 1_000_000_000_000;
  const plan = JSON.parse(
    sanitizeModelPlan(
      JSON.stringify({
        actions: [
          {
            domain: 'meta',
            operation: 'crear',
            resourceId: null,
            payload: { title: 'viaje', targetAmount: '2000000', iconId: 'avion', extra: 1 },
            needsInput: ['title', 'category'],
          },
          { domain: 'movimiento', operation: 'consultar', payload: {}, needsInput: ['desde'] },
          { domain: 'meta', operation: 'eliminar', payload: {}, needsInput: [] },
        ],
      }),
      now
    )
  );
  expect(plan.actions[0]).toEqual({
    domain: 'meta',
    operation: 'crear',
    payload: { title: 'viaje', targetAmount: 2000000, iconId: 'target', category: 'custom' },
    needsInput: [],
  });
  expect(plan.actions[1].needsInput).toEqual([]);
  expect(plan.actions[2].needsInput).toEqual(['resourceId']);
});

test('reemplaza fechas futuras de un gasto por la fecha actual', () => {
  const now = 1_000_000_000_000;
  const plan = JSON.parse(
    sanitizeModelPlan(
      JSON.stringify({
        actions: [
          {
            domain: 'ahorro',
            operation: 'crear',
            payload: { type: 'aporte', amount: 1000, description: 'a', fecha: now * 2 },
          },
        ],
      }),
      now
    )
  );
  expect(plan.actions[0].payload.fecha).toBe(now);
});

test('el límite de Groq se muestra como función no disponible', () => {
  expect(classifyFinancialAssistantError(new ModelRateLimitError('429'))).toEqual({
    code: 'resource-exhausted',
    message: 'Función no disponible',
  });
});
