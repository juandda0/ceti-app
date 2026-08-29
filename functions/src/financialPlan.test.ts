import { FinancialPlanError, parseFinancialPlan } from './financialPlan';

test('acepta hasta cinco acciones y asigna IDs estables', () => {
  const plan = parseFinancialPlan(
    JSON.stringify({
      actions: [
        {
          domain: 'movimiento',
          operation: 'crear',
          payload: {
            tipo: 'gasto',
            monto: 12000,
            descripcion: 'almuerzo',
            categoria: 'comida',
            fecha: 10,
          },
        },
        { domain: 'meta', operation: 'eliminar', resourceId: 'goal_1', payload: {} },
      ],
    }),
    'req_1'
  );

  expect(plan.actions.map((action) => action.actionId)).toEqual(['req_1:0', 'req_1:1']);
  expect(plan.actions.map((action) => action.needsInput)).toEqual([[], []]);
});

test.each([
  '{}',
  '{"actions":[]}',
  '{"actions":[{"domain":"usuario","operation":"eliminar","payload":{}}]}',
  '{"actions":[{"domain":"movimiento","operation":"crear","payload":{"monto":-1}}]}',
])('rechaza plan inválido %s', (raw) => {
  expect(() => parseFinancialPlan(raw, 'r')).toThrow(FinancialPlanError);
});

test('rechaza más de cinco acciones y campos adicionales', () => {
  const action = { domain: 'meta', operation: 'consultar', payload: {} };
  expect(() =>
    parseFinancialPlan(JSON.stringify({ actions: Array(6).fill(action) }), 'r')
  ).toThrow();
  expect(() =>
    parseFinancialPlan(JSON.stringify({ actions: [{ ...action, ignored: true }] }), 'r')
  ).toThrow();
  expect(() =>
    parseFinancialPlan(JSON.stringify({ actions: [action], ignored: true }), 'r')
  ).toThrow();
});

test.each(['consultar', 'crear'])('rechaza resourceId en movimiento/%s', (operation) => {
  const payload =
    operation === 'crear'
      ? {
          tipo: 'gasto',
          monto: 1,
          descripcion: 'x',
          categoria: 'comida',
          fecha: 1,
        }
      : {};

  expect(() =>
    parseFinancialPlan(
      JSON.stringify({
        actions: [{ domain: 'movimiento', operation, resourceId: 'mov_1', payload }],
      }),
      'r'
    )
  ).toThrow(FinancialPlanError);
});

test('valida límites, enums y payloads cerrados', () => {
  const parseAction = (action: object) =>
    parseFinancialPlan(JSON.stringify({ actions: [action] }), 'r');

  expect(() =>
    parseAction({
      domain: 'movimiento',
      operation: 'crear',
      payload: {
        tipo: 'gasto',
        monto: 100_000_001,
        descripcion: 'x',
        categoria: 'comida',
        fecha: 1,
      },
    })
  ).toThrow();
  expect(() =>
    parseAction({
      domain: 'movimiento',
      operation: 'crear',
      payload: {
        tipo: 'gasto',
        monto: 1,
        descripcion: 'x'.repeat(141),
        categoria: 'inventada',
        fecha: 1,
        extra: true,
      },
    })
  ).toThrow();
  expect(() =>
    parseAction({ domain: 'ahorro', operation: 'eliminar', payload: {}, resourceId: '' })
  ).toThrow();
});

test('acepta los payloads de ahorro y meta que consumirá el ejecutor', () => {
  const plan = parseFinancialPlan(
    JSON.stringify({
      actions: [
        {
          domain: 'ahorro',
          operation: 'crear',
          payload: {
            type: 'aporte',
            amount: 5000,
            description: 'aporte bici',
            goalId: 'g1',
            fecha: 20,
          },
        },
        {
          domain: 'meta',
          operation: 'crear',
          payload: {
            title: 'Bici',
            iconId: 'bike',
            category: 'custom',
            targetAmount: 500000,
          },
          needsInput: ['deadline'],
        },
      ],
    }),
    'req'
  );

  expect(plan.actions).toHaveLength(2);
  expect(plan.actions[1].needsInput).toEqual(['deadline']);
});

test('rechaza timestamps fraccionarios, inseguros, fuera de Date y rangos invertidos', () => {
  const query = (desde: number, hasta: number) =>
    JSON.stringify({
      actions: [{ domain: 'movimiento', operation: 'consultar', payload: { desde, hasta } }],
    });

  expect(() => parseFinancialPlan(query(1.5, 2), 'r')).toThrow();
  expect(() => parseFinancialPlan(query(0, Number.MAX_SAFE_INTEGER + 1), 'r')).toThrow();
  expect(() => parseFinancialPlan(query(0, 8_640_000_000_000_001), 'r')).toThrow();
  expect(() => parseFinancialPlan(query(2, 1), 'r')).toThrow();
});

test.each([' espacio', 'a/b', 'a:b', 'a\ncontrol'])(
  'rechaza requestId no canónico %j',
  (requestId) => {
    expect(() =>
      parseFinancialPlan(
        JSON.stringify({ actions: [{ domain: 'meta', operation: 'consultar', payload: {} }] }),
        requestId
      )
    ).toThrow(FinancialPlanError);
  }
);

test.each([' goal_1', 'goal/1', 'goal\u0000'])(
  'rechaza resourceId no canónico %j',
  (resourceId) => {
    expect(() =>
      parseFinancialPlan(
        JSON.stringify({
          actions: [{ domain: 'meta', operation: 'eliminar', resourceId, payload: {} }],
        }),
        'r'
      )
    ).toThrow(FinancialPlanError);
  }
);

test('limita needsInput a nombres únicos y admisibles para la variante', () => {
  const parseNeeds = (needsInput: string[]) =>
    parseFinancialPlan(
      JSON.stringify({
        actions: [{ domain: 'meta', operation: 'consultar', payload: {}, needsInput }],
      }),
      'r'
    );

  expect(() => parseNeeds(['resourceId', 'resourceId'])).toThrow();
  expect(() => parseNeeds(['monto'])).toThrow();
  expect(() =>
    parseFinancialPlan(
      JSON.stringify({
        actions: [
          {
            domain: 'movimiento',
            operation: 'crear',
            payload: {
              tipo: 'gasto',
              monto: 1,
              descripcion: 'x',
              categoria: 'comida',
              fecha: 1,
            },
            needsInput: ['tipo', 'monto', 'descripcion', 'categoria', 'fecha', 'goalId'],
          },
        ],
      }),
      'r'
    )
  ).toThrow();
});

test.each([
  { domain: 'ahorro', operation: 'editar', payload: { amount: 1 } },
  { domain: 'ahorro', operation: 'eliminar', payload: {} },
  { domain: 'meta', operation: 'editar', payload: { title: 'Bici' } },
  { domain: 'meta', operation: 'eliminar', payload: {} },
])('exige resourceId en $domain/$operation', (action) => {
  expect(() => parseFinancialPlan(JSON.stringify({ actions: [action] }), 'r')).toThrow(
    FinancialPlanError
  );
});
