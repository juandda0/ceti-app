import {
  movimientosOrdenados,
  totalesDelMes,
  totalesPorCategoria,
} from '@features/savings/data/movimientosStats';
import type { Movimiento } from '@features/savings/store/useMovimientosStore';

const ref = new Date(2026, 6, 15); // julio 2026

function mov(partial: Partial<Movimiento>): Movimiento {
  return {
    id: `mov_${Math.random()}`,
    tipo: 'gasto',
    monto: 1000,
    descripcion: 'x',
    categoria: 'otros',
    origen: 'voz',
    createdAt: new Date(2026, 6, 10).getTime(),
    ...partial,
  };
}

describe('totalesDelMes', () => {
  it('suma ahorros y gastos solo del mes de referencia', () => {
    const movimientos = [
      mov({ tipo: 'gasto', monto: 5000 }),
      mov({ tipo: 'ahorro', monto: 20000 }),
      mov({ tipo: 'gasto', monto: 9999, createdAt: new Date(2026, 5, 30).getTime() }), // junio
    ];
    expect(totalesDelMes(movimientos, ref)).toEqual({
      ahorros: 20000,
      gastos: 5000,
      balance: 15000,
    });
  });

  it('devuelve ceros sin movimientos', () => {
    expect(totalesDelMes([], ref)).toEqual({ ahorros: 0, gastos: 0, balance: 0 });
  });
});

describe('totalesPorCategoria', () => {
  it('agrupa por categoría en orden descendente y filtra por tipo y mes', () => {
    const movimientos = [
      mov({ categoria: 'comida', monto: 3000 }),
      mov({ categoria: 'comida', monto: 2000 }),
      mov({ categoria: 'transporte', monto: 8000 }),
      mov({ tipo: 'ahorro', categoria: 'otros', monto: 50000 }),
      mov({ categoria: 'ropa', monto: 700, createdAt: new Date(2026, 5, 1).getTime() }),
    ];
    expect(totalesPorCategoria(movimientos, 'gasto', ref)).toEqual([
      { categoria: 'transporte', total: 8000 },
      { categoria: 'comida', total: 5000 },
    ]);
  });
});

describe('movimientosOrdenados', () => {
  it('ordena del más reciente al más viejo sin mutar el original', () => {
    const a = mov({ createdAt: 1 });
    const b = mov({ createdAt: 3 });
    const c = mov({ createdAt: 2 });
    const input = [a, b, c];
    expect(movimientosOrdenados(input).map((m) => m.createdAt)).toEqual([3, 2, 1]);
    expect(input[0]).toBe(a);
  });
});
