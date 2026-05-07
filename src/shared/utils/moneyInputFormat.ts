/** Entrada de montos enteros (COP): miles con punto mientras el usuario escribe. */

const DEFAULT_MAX_DIGITS = 14;

export function formatMoneyInputThousands(text: string, maxDigits = DEFAULT_MAX_DIGITS): string {
  const raw = text.replace(/\D/g, '').slice(0, maxDigits);
  if (!raw) return '';
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return '';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function parseMoneyAmountInt(formatted: string): number {
  const raw = formatted.replace(/\D/g, '');
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
