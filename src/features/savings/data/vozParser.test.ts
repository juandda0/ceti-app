import { parsearRegistroVoz } from '@features/savings/data/vozParser';
import { vozService } from '@features/savings/data/vozService';
import { callFunction } from '@shared/lib/firebase/functions';

jest.mock('@shared/lib/firebase/functions', () => ({ callFunction: jest.fn() }));

const callFunctionMock = jest.mocked(callFunction);

describe('parsearRegistroVoz', () => {
  it('clasifica un gasto con miles y categoría conocida', () => {
    expect(parsearRegistroVoz('gasté 5 mil en un helado')).toEqual([
      expect.objectContaining({
        intencion: 'movimiento',
        tipo: 'gasto',
        monto: 5000,
        categoria: 'comida',
      }),
    ]);
  });

  it('clasifica ahorro y fecha relativa', () => {
    expect(parsearRegistroVoz('ayer ahorré 20 lucas')).toEqual([
      expect.objectContaining({ tipo: 'ahorro', monto: 20000, offsetDias: -1 }),
    ]);
  });

  it('separa hasta cinco movimientos unidos por y/luego', () => {
    expect(parsearRegistroVoz('gasté 2 mil en bus y luego 5 mil en comida')).toHaveLength(2);
  });

  it('no inventa datos cuando falta el monto', () => {
    expect(parsearRegistroVoz('compré un helado')).toEqual([
      expect.objectContaining({ intencion: 'no_entendido', monto: 0, confianza: 0 }),
    ]);
  });
});

describe('vozService.planificar', () => {
  beforeEach(() => callFunctionMock.mockReset());

  it('sustituye el título exacto de una meta por su ID opaco antes de enviarlo', async () => {
    callFunctionMock.mockResolvedValue({
      actions: [
        {
          actionId: 'r:0',
          domain: 'meta',
          operation: 'eliminar',
          resourceId: 'goal_opaque_1',
          payload: {},
          needsInput: [],
        },
      ],
    });
    const context = {
      goals: [{ id: 'goal_opaque_1', title: 'Viaje a Japón', targetAmount: 2_000_000 }],
      movements: [],
      operations: [],
    };

    await vozService.planificar('elimina Viaje a Japón', context, 'r');

    expect(callFunctionMock).toHaveBeenCalledWith('planificarAccionesFinancieras', {
      text: 'elimina goal_opaque_1',
      context,
      requestId: 'r',
    });
    expect(context.goals[0]?.title).toBe('Viaje a Japón');
  });

  it('limita a 300 el texto final después de expandir un alias', async () => {
    callFunctionMock.mockResolvedValue({
      actions: [
        {
          actionId: 'r:0',
          domain: 'meta',
          operation: 'consultar',
          payload: {},
          needsInput: [],
        },
      ],
    });
    const context = {
      goals: [{ id: `goal_${'x'.repeat(100)}`, title: 'B', targetAmount: 1 }],
      movements: [],
      operations: [],
    };

    await vozService.planificar('B'.repeat(300), context, 'r');

    const sent = callFunctionMock.mock.calls[0]?.[1] as { text: string };
    expect(sent.text).toHaveLength(300);
  });

  it('reemplaza títulos sin importar mayúsculas, con límites de frase Unicode', async () => {
    callFunctionMock.mockResolvedValue({
      actions: [
        {
          actionId: 'r:0',
          domain: 'meta',
          operation: 'consultar',
          payload: {},
          needsInput: [],
        },
      ],
    });
    const context = {
      goals: [{ id: 'goal_1', title: 'Viaje (Japón)', targetAmount: 1 }],
      movements: [],
      operations: [],
    };

    await vozService.planificar('edita viaje (JAPÓN), no Viaje (Japón)es', context, 'r');

    expect(callFunctionMock).toHaveBeenCalledWith(
      'planificarAccionesFinancieras',
      expect.objectContaining({ text: 'edita goal_1, no Viaje (Japón)es' })
    );
  });

  it('no reemplaza un título dentro de otra palabra', async () => {
    callFunctionMock.mockResolvedValue({
      actions: [
        {
          actionId: 'r:0',
          domain: 'meta',
          operation: 'consultar',
          payload: {},
          needsInput: [],
        },
      ],
    });
    const context = {
      goals: [{ id: 'goal_1', title: 'Viaje', targetAmount: 1 }],
      movements: [],
      operations: [],
    };

    await vozService.planificar('consulta Viajes', context, 'r');

    expect(callFunctionMock).toHaveBeenCalledWith(
      'planificarAccionesFinancieras',
      expect.objectContaining({ text: 'consulta Viajes' })
    );
  });

  it('conserva un ID completo cerca del límite de 300', async () => {
    callFunctionMock.mockResolvedValue({
      actions: [
        {
          actionId: 'r:0',
          domain: 'meta',
          operation: 'consultar',
          payload: {},
          needsInput: [],
        },
      ],
    });
    const goalId = `goal_${'x'.repeat(35)}`;
    const context = {
      goals: [{ id: goalId, title: 'Viaje', targetAmount: 1 }],
      movements: [],
      operations: [],
    };

    await vozService.planificar(`${'a'.repeat(240)} Viaje ${'b'.repeat(100)}`, context, 'r');

    const sent = callFunctionMock.mock.calls[0]?.[1] as { text: string };
    expect(sent.text.length).toBeLessThanOrEqual(300);
    expect(sent.text).toContain(goalId);
  });

  it('convierte gastos y ahorros simples en fallback local', async () => {
    callFunctionMock.mockRejectedValue(new Error('offline'));
    const plan = await vozService.planificar(
      'gasté 12 mil en almuerzo y luego ahorré 5 mil',
      { goals: [], movements: [], operations: [] },
      'r'
    );

    expect(plan.source).toBe('local');
    expect(plan.actions).toEqual([
      expect.objectContaining({ actionId: 'r:0', domain: 'movimiento', operation: 'crear' }),
      expect.objectContaining({ actionId: 'r:1', domain: 'movimiento', operation: 'crear' }),
    ]);
  });

  it('relanza el error remoto cuando el fallback no entiende la solicitud', async () => {
    const remoteError = new Error('offline');
    callFunctionMock.mockRejectedValue(remoteError);

    await expect(
      vozService.planificar(
        'crea una meta bicicleta',
        { goals: [], movements: [], operations: [] },
        'r'
      )
    ).rejects.toBe(remoteError);
  });
});
