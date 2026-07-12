import {
  estadoTope,
  gastoSemanalPorCategoria,
  semanasCumpliendoTopes,
} from '@features/savings/data/presupuestos';
import type { Movimiento } from '@features/savings/store/useMovimientosStore';

const NOON_JUL15 = Date.UTC(2026, 6, 15, 17, 0, 0);
const noonJul = (d: number) => Date.UTC(2026, 6, d, 17, 0, 0);

function mov(p: Partial<Movimiento>): Movimiento {
  return {
    id: `mov_${Math.random()}`,
    tipo: 'gasto',
    monto: 1000,
    descripcion: 'x',
    categoria: 'comida',
    origen: 'voz',
    createdAt: NOON_JUL15,
    ...p,
  };
}

describe('estadoTope', () => {
  it('umbrales 0.8 y 1.0', () => {
    expect(estadoTope(790, 1000)).toBe('ok');
    expect(estadoTope(800, 1000)).toBe('cerca');
    expect(estadoTope(1000, 1000)).toBe('cerca');
    expect(estadoTope(1010, 1000)).toBe('excedido');
  });
  it('tope no positivo no revienta', () => {
    expect(estadoTope(500, 0)).toBe('ok');
    expect(estadoTope(500, -10)).toBe('ok');
  });
});

describe('gastoSemanalPorCategoria', () => {
  it('suma gastos de la semana actual, excluye ahorros y otras semanas', () => {
    const movimientos = [
      mov({ categoria: 'comida', monto: 3000, fecha: noonJul(14) }),
      mov({ categoria: 'transporte', monto: 8000, fecha: noonJul(15) }),
      mov({ tipo: 'ahorro', categoria: 'otros', monto: 5000, fecha: noonJul(15) }),
      mov({ categoria: 'comida', monto: 700, fecha: noonJul(5) }), // semana anterior
    ];
    expect(gastoSemanalPorCategoria(movimientos, NOON_JUL15)).toEqual({
      comida: 3000,
      transporte: 8000,
    });
  });
});

describe('semanasCumpliendoTopes', () => {
  it('0 sin topes definidos', () => {
    expect(semanasCumpliendoTopes([mov({ fecha: noonJul(8) })], {}, 8, NOON_JUL15)).toBe(0);
  });

  it('0 si la semana anterior excedió el tope', () => {
    const movimientos = [mov({ categoria: 'comida', monto: 6000, fecha: noonJul(8) })];
    expect(semanasCumpliendoTopes(movimientos, { comida: 5000 }, 8, NOON_JUL15)).toBe(0);
  });

  it('cuenta semanas limpias hasta que una excede', () => {
    const movimientos = [
      mov({ categoria: 'comida', monto: 3000, fecha: noonJul(8) }), // semana Jul6-12: limpia
      mov({ categoria: 'comida', monto: 9000, fecha: noonJul(1) }), // semana Jun29-Jul5: excede
    ];
    expect(semanasCumpliendoTopes(movimientos, { comida: 5000 }, 8, NOON_JUL15)).toBe(1);
  });
});
