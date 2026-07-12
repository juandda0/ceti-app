/**
 * Racha de registro: días calendario (Bogotá) consecutivos con ≥1 movimiento,
 * terminando hoy o ayer (gracia de 1 día). Se recomputa en cada render y JAMÁS
 * se persiste (R5): no es un rasgo del menor, es un cálculo efímero self-view.
 * RQ-ES11-CA4. Puro.
 */
import type { Movimiento } from '@features/savings/store/useMovimientosStore';
import { dayKey, fechaDe } from '@features/savings/data/periodos';

const DIA_MS = 24 * 60 * 60 * 1000;

export function computeRacha(
  movimientos: Movimiento[],
  now: number = Date.now()
): { dias: number; registroHoy: boolean } {
  if (movimientos.length === 0) return { dias: 0, registroHoy: false };

  const dias = new Set(movimientos.map((m) => dayKey(fechaDe(m))));
  const registroHoy = dias.has(dayKey(now));

  // La racha viva termina hoy (si registró) o ayer (gracia). Bogotá no tiene DST,
  // así que restar 24h siempre retrocede exactamente un día calendario.
  let cursor = registroHoy ? now : now - DIA_MS;
  if (!dias.has(dayKey(cursor))) return { dias: 0, registroHoy };

  let count = 0;
  while (dias.has(dayKey(cursor))) {
    count++;
    cursor -= DIA_MS;
  }
  return { dias: count, registroHoy };
}
