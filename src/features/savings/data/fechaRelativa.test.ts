import { resolverFechaLocal } from '@features/savings/data/fechaRelativa';
import { dayKey } from '@features/savings/data/periodos';

// 12:00 Bogotá del miércoles 15 de julio de 2026.
const NOON_JUL15 = Date.UTC(2026, 6, 15, 17, 0, 0);

function esMediodiaBogota(epoch: number): boolean {
  return new Date(epoch - 5 * 60 * 60 * 1000).getUTCHours() === 12;
}

describe('resolverFechaLocal', () => {
  it('offset 0 → hoy al mediodía local', () => {
    const r = resolverFechaLocal(0, undefined, NOON_JUL15);
    expect(dayKey(r)).toBe('2026-07-15');
    expect(esMediodiaBogota(r)).toBe(true);
  });

  it('offsets negativos retroceden días (cruzando mes)', () => {
    expect(dayKey(resolverFechaLocal(-1, undefined, NOON_JUL15))).toBe('2026-07-14');
    expect(dayKey(resolverFechaLocal(-15, undefined, NOON_JUL15))).toBe('2026-06-30');
  });

  it('clamp a 30 días atrás', () => {
    expect(dayKey(resolverFechaLocal(-45, undefined, NOON_JUL15))).toBe('2026-06-15');
  });

  it('nunca futuro: offset positivo → hoy', () => {
    expect(dayKey(resolverFechaLocal(3, undefined, NOON_JUL15))).toBe('2026-07-15');
  });

  it('entrada no entera o basura → hoy', () => {
    expect(dayKey(resolverFechaLocal(1.5, undefined, NOON_JUL15))).toBe('2026-07-15');
    expect(dayKey(resolverFechaLocal(NaN, undefined, NOON_JUL15))).toBe('2026-07-15');
  });

  it('diaSemana → pasado más reciente', () => {
    // Dicho un miércoles, "viernes" es el viernes anterior (5 días atrás).
    expect(dayKey(resolverFechaLocal(0, 'viernes', NOON_JUL15))).toBe('2026-07-10');
  });

  it('mismo día de la semana → hoy', () => {
    expect(dayKey(resolverFechaLocal(0, 'miércoles', NOON_JUL15))).toBe('2026-07-15');
  });

  it('diaSemana inválido → cae al offsetDias', () => {
    expect(dayKey(resolverFechaLocal(-2, 'febrero', NOON_JUL15))).toBe('2026-07-13');
  });
});
