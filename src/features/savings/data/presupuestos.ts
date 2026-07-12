/**
 * Topes (presupuestos) por categoría: estado de un tope y cumplimiento semanal.
 * Es configuración del propio estudiante (users/{uid}/config/presupuestos),
 * self-view; el tope no es un rasgo del menor (R5). RQ-ES11-CA1. Puro.
 *
 * Nota de nombres: aquí es "tope"/"presupuesto", nunca "autorización" — esa
 * palabra dispara el gate E4 del acudiente (R6).
 */
import type { Movimiento, MovimientoCategoria } from '@features/savings/store/useMovimientosStore';
import { rangoPeriodo, totalesPorCategoriaEnRango } from '@features/savings/data/periodos';

/** Tope semanal por categoría (parcial: solo las que el estudiante definió). */
export type Presupuestos = Partial<Record<MovimientoCategoria, number>>;

export type EstadoTope = 'ok' | 'cerca' | 'excedido';

// Umbral de "cerca" = 80% del tope. Constante de producto (umbral de UX), no una
// cifra económica caducable en pesos, así que R14 no aplica.
export const UMBRAL_CERCA = 0.8;

export function estadoTope(gastado: number, tope: number): EstadoTope {
  if (tope <= 0) return 'ok'; // sin tope válido no hay estado de exceso
  const ratio = gastado / tope;
  if (ratio > 1) return 'excedido';
  if (ratio >= UMBRAL_CERCA) return 'cerca';
  return 'ok';
}

export function gastoSemanalPorCategoria(
  movimientos: Movimiento[],
  now: number = Date.now()
): Partial<Record<MovimientoCategoria, number>> {
  const rango = rangoPeriodo('semana', now);
  const acc: Partial<Record<MovimientoCategoria, number>> = {};
  for (const { categoria, total } of totalesPorCategoriaEnRango(movimientos, 'gasto', rango)) {
    acc[categoria] = total;
  }
  return acc;
}

/**
 * Semanas completas consecutivas (hacia atrás desde la anterior a la actual) en
 * que ningún tope definido se excedió. 0 si no hay topes definidos.
 */
export function semanasCumpliendoTopes(
  movimientos: Movimiento[],
  presupuestos: Presupuestos,
  maxSemanas = 8,
  now: number = Date.now()
): number {
  const topes = (Object.entries(presupuestos) as [MovimientoCategoria, number][]).filter(
    ([, tope]) => tope > 0
  );
  if (topes.length === 0) return 0;

  let count = 0;
  let ref = rangoPeriodo('semana', now).desde - 1; // arranca en la semana anterior
  for (let i = 0; i < maxSemanas; i++) {
    const rango = rangoPeriodo('semana', ref);
    const porCat = new Map(
      totalesPorCategoriaEnRango(movimientos, 'gasto', rango).map((x) => [x.categoria, x.total])
    );
    const limpia = topes.every(([cat, tope]) => (porCat.get(cat) ?? 0) <= tope);
    if (!limpia) break;
    count++;
    ref = rango.desde - 1;
  }
  return count;
}
