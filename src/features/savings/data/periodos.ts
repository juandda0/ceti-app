/**
 * Rangos de periodo (semana/quincena/mes) sobre calendario America/Bogota, y
 * totales del diario en un rango (RQ-ES11-CA2). Puro y testeable; cero ML, cero
 * persistencia. Bogotá es UTC-5 fijo (sin horario de verano), así que el offset
 * es constante y toda la aritmética de días es exacta.
 */
import type {
  Movimiento,
  MovimientoCategoria,
  MovimientoTipo,
} from '@features/savings/store/useMovimientosStore';

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC-5, sin DST
const DIA_MS = 24 * 60 * 60 * 1000;

export type PeriodoTipo = 'semana' | 'quincena' | 'mes';

/** Rango [desde, hasta] en epoch ms, ambos extremos inclusive. */
export interface Rango {
  desde: number;
  hasta: number;
}

/** Fecha efectiva: la declarada por voz si existe, si no la de registro. */
export function fechaDe(m: Pick<Movimiento, 'fecha' | 'createdAt'>): number {
  return m.fecha ?? m.createdAt;
}

interface BogotaParts {
  y: number;
  m: number; // 0-11
  d: number; // 1-31
  dow: number; // 0=domingo .. 6=sábado
}

function partsBogota(epoch: number): BogotaParts {
  const d = new Date(epoch - BOGOTA_OFFSET_MS);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    d: d.getUTCDate(),
    dow: d.getUTCDay(),
  };
}

/** Clave de día calendario en Bogotá ('YYYY-MM-DD'), para contar días distintos. */
export function dayKey(epoch: number): string {
  const { y, m, d } = partsBogota(epoch);
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function inicioDiaBogota(y: number, m: number, d: number): number {
  // Bogotá 00:00 local = 05:00 UTC. Date.UTC normaliza días fuera de rango.
  return Date.UTC(y, m, d, 0, 0, 0, 0) + BOGOTA_OFFSET_MS;
}

function finDiaBogota(y: number, m: number, d: number): number {
  return Date.UTC(y, m, d, 23, 59, 59, 999) + BOGOTA_OFFSET_MS;
}

function ultimoDiaDelMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

export function rangoPeriodo(tipo: PeriodoTipo, ref: number = Date.now()): Rango {
  const { y, m, d, dow } = partsBogota(ref);

  if (tipo === 'mes') {
    return { desde: inicioDiaBogota(y, m, 1), hasta: finDiaBogota(y, m, ultimoDiaDelMes(y, m)) };
  }

  if (tipo === 'quincena') {
    return d <= 15
      ? { desde: inicioDiaBogota(y, m, 1), hasta: finDiaBogota(y, m, 15) }
      : { desde: inicioDiaBogota(y, m, 16), hasta: finDiaBogota(y, m, ultimoDiaDelMes(y, m)) };
  }

  // semana: lunes–domingo. dow 1=lunes → 0 días atrás; dow 0=domingo → 6.
  const diasDesdeLunes = (dow + 6) % 7;
  const lunes = inicioDiaBogota(y, m, d - diasDesdeLunes);
  const domingo = lunes + 6 * DIA_MS;
  const dp = partsBogota(domingo);
  return { desde: lunes, hasta: finDiaBogota(dp.y, dp.m, dp.d) };
}

/** El periodo inmediatamente anterior del mismo tipo. */
export function periodoAnterior(tipo: PeriodoTipo, ref: number = Date.now()): Rango {
  const actual = rangoPeriodo(tipo, ref);
  return rangoPeriodo(tipo, actual.desde - 1);
}

function enRango(f: number, rango: Rango): boolean {
  return f >= rango.desde && f <= rango.hasta;
}

export function totalesEnRango(
  movimientos: Movimiento[],
  rango: Rango
): { ahorros: number; gastos: number; balance: number } {
  let ahorros = 0;
  let gastos = 0;
  for (const mv of movimientos) {
    if (!enRango(fechaDe(mv), rango)) continue;
    if (mv.tipo === 'ahorro') ahorros += mv.monto;
    else gastos += mv.monto;
  }
  return { ahorros, gastos, balance: ahorros - gastos };
}

export function totalesPorCategoriaEnRango(
  movimientos: Movimiento[],
  tipo: MovimientoTipo,
  rango: Rango
): { categoria: MovimientoCategoria; total: number }[] {
  const acc = new Map<MovimientoCategoria, number>();
  for (const mv of movimientos) {
    if (mv.tipo !== tipo || !enRango(fechaDe(mv), rango)) continue;
    acc.set(mv.categoria, (acc.get(mv.categoria) ?? 0) + mv.monto);
  }
  return [...acc.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);
}
