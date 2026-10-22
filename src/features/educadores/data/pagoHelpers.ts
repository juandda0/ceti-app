/**
 * Validación y formato de los medios de pago del profe (celular Nequi y tarjeta).
 * Puro: sin red ni Firebase. Los datos de la tarjeta solo viven en el formulario
 * y van directo a Wompi (wompiTokens.ts); nunca se guardan ni se registran.
 */

/** Deja solo los dígitos. */
export function soloDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

/**
 * Celular colombiano en 10 dígitos (3xxxxxxxxx). Acepta lo que pega la gente:
 * espacios, guiones y el prefijo +57 o 57.
 */
export function normalizarCelular(v: string): string {
  let d = soloDigitos(v);
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  return d.slice(0, 10);
}

export function esCelularValido(v: string): boolean {
  return /^3\d{9}$/.test(normalizarCelular(v));
}

/** '3001234567' → '300 123 4567' (mientras escribe). */
export function formatoCelular(v: string): string {
  const d = normalizarCelular(v);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join(' ');
}

// ─── Tarjeta ─────────────────────────────────────────────────────────────────

export type MarcaTarjeta = 'visa' | 'mastercard' | 'amex' | 'diners' | 'otra';

export function marcaTarjeta(numero: string): MarcaTarjeta {
  const d = soloDigitos(numero);
  if (/^4/.test(d)) return 'visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return 'mastercard';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^3(0[0-5]|[689])/.test(d)) return 'diners';
  return 'otra';
}

/** Dígito de control (Luhn). */
export function pasaLuhn(numero: string): boolean {
  const d = soloDigitos(numero);
  if (d.length === 0) return false;
  let suma = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    suma += n;
  }
  return suma % 10 === 0;
}

const LARGO_MAX: Record<MarcaTarjeta, number> = {
  visa: 19,
  mastercard: 16,
  amex: 15,
  diners: 14,
  otra: 19,
};

export function numeroTarjetaValido(numero: string): boolean {
  const d = soloDigitos(numero);
  const marca = marcaTarjeta(d);
  const min = marca === 'amex' ? 15 : marca === 'diners' ? 14 : 13;
  return d.length >= min && d.length <= LARGO_MAX[marca] && pasaLuhn(d);
}

/** Agrupa mientras escribe: 4-4-4-4 (Amex 4-6-5). Corta en el largo de la marca. */
export function formatoNumeroTarjeta(v: string): string {
  const marca = marcaTarjeta(v);
  const d = soloDigitos(v).slice(0, LARGO_MAX[marca]);
  if (marca === 'amex') {
    return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(' ');
  }
  return d.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** 'MMAA' → 'MM/AA' mientras escribe (un '1' suelto espera; un '5' pasa a '05/'). */
export function formatoVencimiento(v: string): string {
  let d = soloDigitos(v).slice(0, 4);
  if (d.length === 1 && Number(d) > 1) d = `0${d}`;
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** 'MM/AA' → { mes: '08', anio: '28' } o null si no tiene esa forma. */
export function leerVencimiento(v: string): { mes: string; anio: string } | null {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const mes = Number(m[1]);
  if (mes < 1 || mes > 12) return null;
  return { mes: m[1], anio: m[2] };
}

/** La tarjeta vale hasta el último día del mes que trae impreso. */
export function vencimientoValido(v: string, ahora: number): boolean {
  const f = leerVencimiento(v);
  if (!f) return false;
  const anio = 2000 + Number(f.anio);
  const finDeMes = Date.UTC(anio, Number(f.mes), 1);
  return finDeMes > ahora && anio - new Date(ahora).getUTCFullYear() <= 20;
}

export function cvcValido(cvc: string, marca: MarcaTarjeta): boolean {
  return (marca === 'amex' ? /^\d{4}$/ : /^\d{3,4}$/).test(cvc);
}

export function titularValido(nombre: string): boolean {
  const n = nombre.trim();
  return n.length >= 3 && n.length <= 60 && /^[\p{L}][\p{L} .'-]*$/u.test(n);
}

export interface FormularioTarjeta {
  numero: string;
  vence: string;
  cvc: string;
  titular: string;
}

export type CampoTarjeta = keyof FormularioTarjeta;

/** Campos con error (vacío = listo para tokenizar). */
export function erroresTarjeta(f: FormularioTarjeta, ahora: number): CampoTarjeta[] {
  const errores: CampoTarjeta[] = [];
  if (!numeroTarjetaValido(f.numero)) errores.push('numero');
  if (!vencimientoValido(f.vence, ahora)) errores.push('vence');
  if (!cvcValido(f.cvc, marcaTarjeta(f.numero))) errores.push('cvc');
  if (!titularValido(f.titular)) errores.push('titular');
  return errores;
}

/** Últimos 4 para mostrar ("•••• 4242"); nunca el número completo. */
export function ultimosCuatro(numero: string): string {
  return soloDigitos(numero).slice(-4);
}
