import {
  dayKey,
  fechaDe,
  periodoAnterior,
  rangoPeriodo,
  totalesEnRango,
  totalesPorCategoriaEnRango,
} from '@features/savings/data/periodos';
import type { Movimiento } from '@features/savings/store/useMovimientosStore';

// 12:00 Bogotá del miércoles 15 de julio de 2026 (17:00 UTC).
const NOON_JUL15 = Date.UTC(2026, 6, 15, 17, 0, 0);
const noonBogota = (m: number, d: number) => Date.UTC(2026, m, d, 17, 0, 0);

function mov(p: Partial<Movimiento>): Movimiento {
  return {
    id: `mov_${Math.random()}`,
    tipo: 'gasto',
    monto: 1000,
    descripcion: 'x',
    categoria: 'otros',
    origen: 'voz',
    createdAt: NOON_JUL15,
    ...p,
  };
}

describe('dayKey (calendario Bogotá)', () => {
  it('03:00 UTC cae en el día anterior en Bogotá (22:00)', () => {
    expect(dayKey(Date.UTC(2026, 6, 15, 3, 0, 0))).toBe('2026-07-14');
  });
  it('mediodía UTC-tarde cae en el mismo día', () => {
    expect(dayKey(Date.UTC(2026, 6, 15, 17, 0, 0))).toBe('2026-07-15');
  });
});

describe('rangoPeriodo', () => {
  it('semana: lunes a domingo conteniendo el ref', () => {
    const r = rangoPeriodo('semana', NOON_JUL15);
    expect(dayKey(r.desde)).toBe('2026-07-13'); // lunes
    expect(dayKey(r.hasta)).toBe('2026-07-19'); // domingo
    expect(r.desde).toBeLessThanOrEqual(NOON_JUL15);
    expect(r.hasta).toBeGreaterThanOrEqual(NOON_JUL15);
  });

  it('quincena: día 15 → [1..15]', () => {
    const r = rangoPeriodo('quincena', NOON_JUL15);
    expect(dayKey(r.desde)).toBe('2026-07-01');
    expect(dayKey(r.hasta)).toBe('2026-07-15');
  });

  it('quincena: día 20 → [16..fin de mes]', () => {
    const r = rangoPeriodo('quincena', noonBogota(6, 20));
    expect(dayKey(r.desde)).toBe('2026-07-16');
    expect(dayKey(r.hasta)).toBe('2026-07-31');
  });

  it('mes: día 1 a fin de mes', () => {
    const r = rangoPeriodo('mes', NOON_JUL15);
    expect(dayKey(r.desde)).toBe('2026-07-01');
    expect(dayKey(r.hasta)).toBe('2026-07-31');
  });
});

describe('periodoAnterior', () => {
  it('quincena 1-15 → 16-fin del mes anterior', () => {
    const r = periodoAnterior('quincena', NOON_JUL15);
    expect(dayKey(r.desde)).toBe('2026-06-16');
    expect(dayKey(r.hasta)).toBe('2026-06-30');
  });
  it('semana → la semana previa', () => {
    const r = periodoAnterior('semana', NOON_JUL15);
    expect(dayKey(r.desde)).toBe('2026-07-06');
    expect(dayKey(r.hasta)).toBe('2026-07-12');
  });
});

describe('totalesEnRango', () => {
  const rangoJul = rangoPeriodo('mes', NOON_JUL15);

  it('suma por tipo dentro del rango y excluye fuera', () => {
    const movimientos = [
      mov({ tipo: 'gasto', monto: 5000, fecha: noonBogota(6, 10) }),
      mov({ tipo: 'ahorro', monto: 20000, fecha: noonBogota(6, 12) }),
      mov({ tipo: 'gasto', monto: 9999, fecha: noonBogota(5, 30) }), // junio, fuera
    ];
    expect(totalesEnRango(movimientos, rangoJul)).toEqual({
      ahorros: 20000,
      gastos: 5000,
      balance: 15000,
    });
  });

  it('usa la fecha declarada, no createdAt', () => {
    const movimientos = [
      // Registrado en julio pero declarado en junio → NO cuenta en julio.
      mov({ tipo: 'gasto', monto: 1234, createdAt: noonBogota(6, 10), fecha: noonBogota(5, 30) }),
    ];
    expect(totalesEnRango(movimientos, rangoJul)).toEqual({ ahorros: 0, gastos: 0, balance: 0 });
  });
});

describe('totalesPorCategoriaEnRango', () => {
  it('agrupa por categoría descendente, filtra por tipo y rango', () => {
    const rangoJul = rangoPeriodo('mes', NOON_JUL15);
    const movimientos = [
      mov({ categoria: 'comida', monto: 3000, fecha: noonBogota(6, 14) }),
      mov({ categoria: 'comida', monto: 2000, fecha: noonBogota(6, 15) }),
      mov({ categoria: 'transporte', monto: 8000, fecha: noonBogota(6, 15) }),
      mov({ tipo: 'ahorro', categoria: 'otros', monto: 50000, fecha: noonBogota(6, 15) }),
      mov({ categoria: 'ropa', monto: 700, fecha: noonBogota(5, 1) }), // junio, fuera
    ];
    expect(totalesPorCategoriaEnRango(movimientos, 'gasto', rangoJul)).toEqual([
      { categoria: 'transporte', total: 8000 },
      { categoria: 'comida', total: 5000 },
    ]);
  });
});

describe('fechaDe', () => {
  it('prefiere fecha declarada; si no, createdAt', () => {
    expect(fechaDe({ fecha: 5, createdAt: 9 })).toBe(5);
    expect(fechaDe({ createdAt: 9 })).toBe(9);
  });
});
