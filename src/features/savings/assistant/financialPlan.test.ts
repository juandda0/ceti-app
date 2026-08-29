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
