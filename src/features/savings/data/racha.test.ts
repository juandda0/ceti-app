import { computeRacha } from '@features/savings/data/racha';
import type { Movimiento } from '@features/savings/store/useMovimientosStore';

const NOON_JUL15 = Date.UTC(2026, 6, 15, 17, 0, 0);
const noonJul = (d: number) => Date.UTC(2026, 6, d, 17, 0, 0);

function mov(fecha: number): Movimiento {
  return {
    id: `mov_${Math.random()}`,
    tipo: 'gasto',
    monto: 1000,
    descripcion: 'x',
    categoria: 'otros',
    origen: 'voz',
    createdAt: fecha,
    fecha,
  };
}

describe('computeRacha', () => {
  it('cuenta días consecutivos terminando hoy', () => {
    const r = computeRacha([mov(noonJul(15)), mov(noonJul(14)), mov(noonJul(13))], NOON_JUL15);
    expect(r).toEqual({ dias: 3, registroHoy: true });
  });

  it('un hueco de un día rompe la racha', () => {
    const r = computeRacha([mov(noonJul(15)), mov(noonJul(13))], NOON_JUL15);
    expect(r).toEqual({ dias: 1, registroHoy: true });
  });

  it('varios movimientos el mismo día cuentan como un día', () => {
    const r = computeRacha([mov(noonJul(15)), mov(noonJul(15))], NOON_JUL15);
    expect(r).toEqual({ dias: 1, registroHoy: true });
  });

  it('sin registro hoy pero sí ayer → racha viva (gracia)', () => {
    const r = computeRacha([mov(noonJul(14)), mov(noonJul(13))], NOON_JUL15);
    expect(r).toEqual({ dias: 2, registroHoy: false });
  });

  it('sin movimientos → racha 0', () => {
    expect(computeRacha([], NOON_JUL15)).toEqual({ dias: 0, registroHoy: false });
  });

  it('último registro hace 2 días → racha rota', () => {
    const r = computeRacha([mov(noonJul(13))], NOON_JUL15);
    expect(r).toEqual({ dias: 0, registroHoy: false });
  });
});
