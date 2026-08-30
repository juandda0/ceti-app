import {
  buildFinancialContext,
  parseClientFinancialPlan,
} from '@features/savings/assistant/financialPlan';

const validAction = {
  actionId: 'r:0',
  domain: 'movimiento',
  operation: 'crear',
  payload: {
    tipo: 'gasto',
    monto: 12_000,
    descripcion: 'almuerzo',
    categoria: 'comida',
    fecha: 10,
  },
  needsInput: [],
};

describe('parseClientFinancialPlan', () => {
  it('acepta una respuesta válida del servidor', () => {
    expect(parseClientFinancialPlan({ actions: [validAction] })).toEqual({
      actions: [validAction],
      source: 'remote',
    });
  });

  it.each([
    { ...validAction, domain: 'usuario' },
    { ...validAction, operation: 'publicar' },
    { ...validAction, leaked: true },
    { ...validAction, payload: { ...validAction.payload, leaked: true } },
  ])('rechaza una acción o campo desconocido del servidor', (action) => {
    expect(() => parseClientFinancialPlan({ actions: [action] })).toThrow();
  });

  it.each([
    { ...validAction, needsInput: ['resourceId'] },
    {
      ...validAction,
      domain: 'ahorro',
      operation: 'consultar',
      payload: {},
      needsInput: ['resourceId'],
    },
  ])('mantiene needsInput cerrado por variante como el servidor', (action) => {
    expect(() => parseClientFinancialPlan({ actions: [action] })).toThrow();
  });

  it('aplica el mismo límite superior de timestamp seguro que el servidor', () => {
    expect(() =>
      parseClientFinancialPlan({
        actions: [
          {
            ...validAction,
            payload: { ...validAction.payload, fecha: 8_640_000_000_000_001 },
          },
        ],
      })
    ).toThrow();
    expect(
      parseClientFinancialPlan({
        actions: [
          {
            ...validAction,
            payload: { ...validAction.payload, fecha: 8_640_000_000_000_000 },
          },
        ],
      }).actions[0]
    ).toBeDefined();
  });

  it('acepta una consulta de meta resuelta con resourceId', () => {
    expect(
      parseClientFinancialPlan({
        actions: [
          {
            actionId: 'r:0',
            domain: 'meta',
            operation: 'consultar',
            resourceId: 'goal_1',
            payload: {},
            needsInput: [],
          },
        ],
      }).actions[0]
    ).toMatchObject({ resourceId: 'goal_1' });
  });

  it('lleva a la UI una creación parcial cuando needsInput declara el campo faltante', () => {
    expect(
      parseClientFinancialPlan({
        actions: [
          {
            actionId: 'r:0',
            domain: 'meta',
            operation: 'crear',
            payload: { title: 'Bici', iconId: 'bike', category: 'custom' },
            needsInput: ['targetAmount'],
          },
        ],
      }).actions[0]
    ).toMatchObject({ needsInput: ['targetAmount'], payload: { title: 'Bici' } });
  });

  it.each([
    { ...validAction, payload: { tipo: 'gasto', monto: 1 }, needsInput: [] },
    {
      actionId: 'r:0',
      domain: 'meta',
      operation: 'editar',
      payload: { title: 'Bici' },
      needsInput: [],
    },
    {
      actionId: 'r:0',
      domain: 'meta',
      operation: 'eliminar',
      payload: {},
      needsInput: [],
    },
  ])('rechaza faltantes remotos que no estén en needsInput', (action) => {
    expect(() => parseClientFinancialPlan({ actions: [action] })).toThrow();
  });

  it.each(['editar', 'eliminar'] as const)(
    'acepta %s sin resourceId cuando needsInput lo declara',
    (operation) => {
      expect(
        parseClientFinancialPlan({
          actions: [
            {
              actionId: 'r:0',
              domain: 'meta',
              operation,
              payload: operation === 'editar' ? { title: 'Bici' } : {},
              needsInput: ['resourceId'],
            },
          ],
        }).actions[0]
      ).toMatchObject({ operation, needsInput: ['resourceId'] });
    }
  );

  it('acepta el plan completo después de completar el campo solicitado', () => {
    const partial = {
      actionId: 'r:0',
      domain: 'meta',
      operation: 'crear',
      payload: { title: 'Bici', iconId: 'bike', category: 'custom' },
      needsInput: ['targetAmount'],
    };
    const completed = {
      ...partial,
      payload: { ...partial.payload, targetAmount: 500_000 },
      needsInput: [],
    };

    expect(parseClientFinancialPlan({ actions: [completed] }).actions[0]).toMatchObject(completed);
  });

  it.each([
    {
      actionId: 'r:0',
      domain: 'meta',
      operation: 'editar',
      payload: {},
      needsInput: ['resourceId'],
    },
    {
      actionId: 'r:0',
      domain: 'meta',
      operation: 'crear',
      payload: { title: 'Bici', iconId: 'bike', category: 'custom', targetAmount: 1 },
      needsInput: ['targetAmount'],
    },
    {
      actionId: 'r:0',
      domain: 'meta',
      operation: 'editar',
      resourceId: 'goal_1',
      payload: { title: 'Bici' },
      needsInput: ['resourceId'],
    },
  ])('rechaza needsInput remoto que no corresponde a un dato ausente', (action) => {
    expect(() => parseClientFinancialPlan({ actions: [action] })).toThrow();
  });

  it('queda ejecutable al completar el recurso y el campo pendiente de una edición', () => {
    const partial = {
      actionId: 'r:0',
      domain: 'meta',
      operation: 'editar',
      payload: {},
      needsInput: ['resourceId', 'title'],
    };
    const completed = {
      ...partial,
      resourceId: 'goal_1',
      payload: { title: 'Bici' },
      needsInput: [],
    };

    expect(parseClientFinancialPlan({ actions: [completed] }).actions[0]).toMatchObject(completed);
  });
});

describe('buildFinancialContext', () => {
  it('limita a 30 recursos recientes y omite identidad y metadatos locales', () => {
    const movements = Array.from({ length: 31 }, (_, index) => ({
      id: `m${index}`,
      tipo: 'gasto' as const,
      monto: index + 1,
      descripcion: `movimiento ${index}`,
      categoria: 'otros' as const,
      origen: 'manual' as const,
      fecha: index,
      createdAt: index,
      updatedAt: index,
    }));
    const context = buildFinancialContext(movements, [], []);

    expect(context.movements).toHaveLength(30);
    expect(context.movements[0]?.id).toBe('m30');
    expect(context.movements[0]).not.toHaveProperty('origen');
    expect(context).not.toHaveProperty('uid');
  });
});
