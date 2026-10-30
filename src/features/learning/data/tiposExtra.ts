/**
 * Tipos de pregunta que escribe el profe (Fase 4): emparejar, completar el
 * espacio y respuesta numérica. Corrección y lectura de respuestas. Puro.
 */
import { hashStr, stableShuffle } from '@shared/lib/quizUtils';
import type { CompletarItem, EmparejarItem, NumericaItem } from './quiz.types';

export const MIN_PARES = 3;
export const MAX_PARES = 5;
export const MARCA_ESPACIO = '___';

/**
 * Lee un número como lo escribe alguien en Colombia: "1.500" (miles con punto),
 * "2,5" (decimal con coma), "$ 12.000", "1500.5" o "-3". null si no es número.
 */
export function leerNumero(texto: string): number | null {
  let s = texto
    .trim()
    .replace(/[$\s]/g, '')
    .replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ%]+$/u, '');
  if (!/^-?[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  if (s.includes(',')) {
    // Con coma, la coma es el decimal y los puntos son miles.
    if ((s.match(/,/g) ?? []).length > 1) return null;
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function esNumericaCorrecta(item: NumericaItem, texto: string): boolean {
  const n = leerNumero(texto);
  return n != null && Math.abs(n - item.respuesta) <= Math.max(0, item.tolerancia) + 1e-9;
}

/** Número con formato colombiano para mostrar la respuesta correcta. */
export function formatoNumero(n: number): string {
  return n.toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

/** Orden en que se muestra la columna derecha (estable por pregunta). */
export function ordenDerecha(item: EmparejarItem): number[] {
  return stableShuffle(
    item.pares.map((_, i) => i),
    hashStr(`${item.id}:derecha`)
  );
}

/**
 * `elegidos[i]` = índice del par cuya derecha eligió para la izquierda i
 * (-1 = sin elegir). Es correcta si cada izquierda quedó con su propia pareja.
 */
export function esEmparejarCorrecto(item: EmparejarItem, elegidos: number[]): boolean {
  return item.pares.length > 0 && item.pares.every((_, i) => elegidos[i] === i);
}

export function emparejarCompleto(item: EmparejarItem, elegidos: number[]): boolean {
  return item.pares.every((_, i) => (elegidos[i] ?? -1) >= 0);
}

export function esCompletarCorrecto(item: CompletarItem, indice: number): boolean {
  return indice === item.correctIndex;
}

/** El enunciado de completar con el espacio relleno (o en blanco). */
export function fraseCompletada(item: CompletarItem, indice: number | null): string {
  const relleno = indice != null && item.opciones[indice] != null ? item.opciones[indice] : '_____';
  return item.enunciado.includes(MARCA_ESPACIO)
    ? item.enunciado.replace(MARCA_ESPACIO, relleno)
    : `${item.enunciado} ${relleno}`;
}

/** null si la pregunta está bien armada; si no, la clave del problema. */
export function errorItemExtra(item: EmparejarItem | CompletarItem | NumericaItem): string | null {
  if (!item.enunciado.trim()) return 'sin_enunciado';
  if (item.tipo === 'emparejar') {
    if (item.pares.length < MIN_PARES || item.pares.length > MAX_PARES) return 'pares';
    if (item.pares.some((p) => !p.izquierda.trim() || !p.derecha.trim())) return 'par_vacio';
    const derechas = item.pares.map((p) => p.derecha.trim().toLowerCase());
    if (new Set(derechas).size !== derechas.length) return 'par_repetido';
    return null;
  }
  if (item.tipo === 'completar') {
    if (!item.enunciado.includes(MARCA_ESPACIO)) return 'sin_espacio';
    if (item.opciones.length < 2 || item.opciones.some((o) => !o.trim())) return 'opciones';
    if (item.correctIndex < 0 || item.correctIndex >= item.opciones.length) return 'correcta';
    return null;
  }
  if (!Number.isFinite(item.respuesta)) return 'numero';
  if (!Number.isFinite(item.tolerancia) || item.tolerancia < 0) return 'tolerancia';
  return null;
}
