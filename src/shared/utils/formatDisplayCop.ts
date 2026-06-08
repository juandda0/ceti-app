/** Umbral (COP): a partir de aquí se usa forma corta (miles / millones). */
const COMPACT_FROM = 100_000;

/**
 * Texto para mostrar ahorros en COP: completo con miles hasta el umbral; si es mayor, resume en mil o M.
 */
export function formatDisplayCopGoals(amount: number): string {
  const n = Math.max(0, Math.round(amount));
  if (n < COMPACT_FROM) {
    return `$${n.toLocaleString('es-CO')}`;
  }
  if (n < 1_000_000) {
    const thousands = Math.round(n / 1000);
    return `$${thousands.toLocaleString('es-CO')} mil`;
  }
  const millions = n / 1_000_000;
  const dec = Math.round(millions * 10) / 10;
  const label = Number.isInteger(dec) ? String(dec) : dec.toFixed(1).replace('.', ',');
  return `$${label} M`;
}
