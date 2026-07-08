/**
 * Helpers puros para el dashboard solo-vista-propia de movimientos (RQ-ES10).
 */
import type {
  Movimiento,
  MovimientoCategoria,
  MovimientoTipo,
} from '@features/savings/store/useMovimientosStore';

function esDelMes(createdAt: number, ref: Date): boolean {
  const d = new Date(createdAt);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

export function totalesDelMes(
  movimientos: Movimiento[],
  ref: Date = new Date()
): { ahorros: number; gastos: number; balance: number } {
  let ahorros = 0;
  let gastos = 0;
  for (const m of movimientos) {
    if (!esDelMes(m.createdAt, ref)) continue;
    if (m.tipo === 'ahorro') ahorros += m.monto;
    else gastos += m.monto;
  }
  return { ahorros, gastos, balance: ahorros - gastos };
}

export function totalesPorCategoria(
  movimientos: Movimiento[],
  tipo: MovimientoTipo,
  ref: Date = new Date()
): Array<{ categoria: MovimientoCategoria; total: number }> {
  const acc = new Map<MovimientoCategoria, number>();
  for (const m of movimientos) {
    if (m.tipo !== tipo || !esDelMes(m.createdAt, ref)) continue;
    acc.set(m.categoria, (acc.get(m.categoria) ?? 0) + m.monto);
  }
  return [...acc.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);
}

export function movimientosOrdenados(movimientos: Movimiento[]): Movimiento[] {
  return [...movimientos].sort((a, b) => b.createdAt - a.createdAt);
}
