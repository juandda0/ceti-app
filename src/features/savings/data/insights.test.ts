import { computeInsights, type InsightCtx } from '@features/savings/data/insights';
import type { Movimiento } from '@features/savings/store/useMovimientosStore';
import type { SavingsDeposit, SavingsGoal } from '@features/savings/store/useSavingsStore';

const NOON_JUL15 = Date.UTC(2026, 6, 15, 17, 0, 0);
const noonJul = (d: number) => Date.UTC(2026, 6, d, 17, 0, 0);
const DIA = 24 * 60 * 60 * 1000;

function mov(p: Partial<Movimiento>): Movimiento {
  return {
    id: `mov_${Math.random()}`,
    tipo: 'gasto',
    monto: 1000,
    descripcion: 'x',
    categoria: 'comida',
    origen: 'voz',
    createdAt: NOON_JUL15,
    fecha: NOON_JUL15,
    ...p,
  };
}

function ctx(p: Partial<InsightCtx>): InsightCtx {
  return { movimientos: [], goals: [], deposits: [], presupuestos: {}, now: NOON_JUL15, ...p };
}

const ids = (c: InsightCtx) => computeInsights(c, 8).map((i) => i.id);

describe('computeInsights — topes', () => {
  it('tope excedido dispara y gana a cerca', () => {
    const c = ctx({
      movimientos: [mov({ categoria: 'comida', monto: 6000, fecha: noonJul(14) })],
      presupuestos: { comida: 5000 },
    });
    expect(ids(c)).toContain('tope_excedido');
    expect(ids(c)).not.toContain('tope_cerca');
  });

  it('tope cerca dispara sin exceso', () => {
    const c = ctx({
      movimientos: [mov({ categoria: 'comida', monto: 4500, fecha: noonJul(14) })],
      presupuestos: { comida: 5000 },
    });
    expect(ids(c)).toContain('tope_cerca');
    expect(ids(c)).not.toContain('tope_excedido');
  });
});

describe('computeInsights — gasto_subio (≥30% y ≥$5.000)', () => {
  it('dispara cuando supera ambos umbrales', () => {
    const c = ctx({
      movimientos: [
        mov({ monto: 10000, fecha: noonJul(8) }), // semana anterior
        mov({ monto: 16000, fecha: noonJul(15) }), // semana actual
      ],
    });
    expect(ids(c)).toContain('gasto_subio');
  });

  it('no dispara si el delta es menor a $5.000', () => {
    const c = ctx({
      movimientos: [
        mov({ monto: 10000, fecha: noonJul(8) }),
        mov({ monto: 12000, fecha: noonJul(15) }),
      ],
    });
    expect(ids(c)).not.toContain('gasto_subio');
  });
});

describe('computeInsights — otras reglas', () => {
  it('racha dispara con ≥2 días', () => {
    const c = ctx({ movimientos: [mov({ fecha: noonJul(14) }), mov({ fecha: noonJul(15) })] });
    expect(ids(c)).toContain('racha');
  });

  it('ritmo_meta proyecta la primera meta activa', () => {
    const goal: SavingsGoal = {
      id: 'g1',
      title: 't',
      description: '',
      emoji: '🎯',
      targetAmount: 120000,
      currentAmount: 85000,
      frequency: 'total',
      createdAt: NOON_JUL15 - 60 * DIA,
      category: 'custom',
    };
    const deposits: SavingsDeposit[] = [
      { id: 'd1', goalId: 'g1', amount: 45000, description: '', createdAt: NOON_JUL15 - 10 * DIA },
      { id: 'd2', goalId: 'g1', amount: 45000, description: '', createdAt: NOON_JUL15 - 20 * DIA },
    ];
    const result = computeInsights(ctx({ goals: [goal], deposits }), 8);
    const ritmo = result.find((i) => i.id === 'ritmo_meta');
    expect(ritmo?.params?.meses).toBe(2);
  });

  it('mayor_categoria y balance_positivo con ahorro dominante', () => {
    const c = ctx({
      movimientos: [
        mov({ tipo: 'ahorro', categoria: 'otros', monto: 50000, fecha: noonJul(10) }),
        mov({ tipo: 'gasto', categoria: 'transporte', monto: 8000, fecha: noonJul(10) }),
      ],
    });
    expect(ids(c)).toContain('mayor_categoria');
    expect(ids(c)).toContain('balance_positivo');
  });
});

describe('computeInsights — orden y límites', () => {
  it('el de mayor prioridad va primero y respeta el máximo', () => {
    const c = ctx({
      movimientos: [
        mov({ categoria: 'comida', monto: 6000, fecha: noonJul(14) }), // tope excedido (prio 1)
        mov({ tipo: 'ahorro', categoria: 'otros', monto: 9000, fecha: noonJul(15) }), // racha + balance
      ],
      presupuestos: { comida: 5000 },
    });
    const result = computeInsights(c, 2);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('tope_excedido');
  });

  it('contexto vacío → sin insights', () => {
    expect(computeInsights(ctx({}), 8)).toEqual([]);
  });

  it('es determinista', () => {
    const c = ctx({ movimientos: [mov({ fecha: noonJul(14) }), mov({ fecha: noonJul(15) })] });
    expect(computeInsights(c, 8)).toEqual(computeInsights(c, 8));
  });
});
