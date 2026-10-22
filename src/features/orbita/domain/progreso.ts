/**
 * XP y meta diaria. El XP mide esfuerzo: se gana por respuesta, no se gasta y
 * alimenta la meta del día y el total de la semana. La meta diaria va separada
 * de la racha (la racha se mantiene con 1 práctica; la meta es lo que el joven
 * eligió). Pasado el doble de la meta, todo rinde la mitad: queremos todos los
 * días, no maratones. Puro.
 */
import { diasEntre, lunesDe } from './tiempo';

export type MetaDiaria = 'crucero' | 'orbita' | 'hiper';

export const METAS: readonly MetaDiaria[] = ['crucero', 'orbita', 'hiper'];
export const LECCIONES_POR_META: Record<MetaDiaria, number> = { crucero: 1, orbita: 3, hiper: 5 };

export const XP_ACIERTO = 2;
export const XP_COMBO = 1;
/** Aciertos seguidos desde los que cada acierto suma XP_COMBO extra. */
export const COMBO_DESDE = 5;
export const XP_LECCION_COMPLETA = 5;
export const XP_LECCION_PERFECTA = 5;
const DIAS_GUARDADOS = 60;

export interface EstadoProgreso {
  xpTotal: number;
  xpPorDia: Record<string, number>;
  leccionesPorDia: Record<string, number>;
}

export const PROGRESO_INICIAL: EstadoProgreso = { xpTotal: 0, xpPorDia: {}, leccionesPorDia: {} };

/** XP de una respuesta. `comboPrevio` = aciertos seguidos antes de esta. */
export function xpRespuesta(correcta: boolean, comboPrevio: number): number {
  if (!correcta) return 0;
  return XP_ACIERTO + (comboPrevio + 1 >= COMBO_DESDE ? XP_COMBO : 0);
}

export function xpCierre(perfecta: boolean): number {
  return XP_LECCION_COMPLETA + (perfecta ? XP_LECCION_PERFECTA : 0);
}

/** 1 hasta el doble de la meta; 0,5 después. */
export function factorRendimiento(leccionesHoyAntes: number, meta: MetaDiaria): number {
  return leccionesHoyAntes >= 2 * LECCIONES_POR_META[meta] ? 0.5 : 1;
}

export function leccionesHoy(e: EstadoProgreso, hoy: string): number {
  return e.leccionesPorDia[hoy] ?? 0;
}

export function xpHoy(e: EstadoProgreso, hoy: string): number {
  return e.xpPorDia[hoy] ?? 0;
}

export function xpSemana(e: EstadoProgreso, hoy: string): number {
  const lunes = lunesDe(hoy);
  return Object.entries(e.xpPorDia)
    .filter(([d]) => d >= lunes && d <= hoy)
    .reduce((s, [, xp]) => s + xp, 0);
}

function podar(registro: Record<string, number>, hoy: string): Record<string, number> {
  return Object.fromEntries(
    Object.entries(registro).filter(([d]) => diasEntre(d, hoy) < DIAS_GUARDADOS)
  );
}

/** Suma una lección terminada con su XP (ya ajustado por rendimiento). */
export function sumarLeccion(e: EstadoProgreso, hoy: string, xp: number): EstadoProgreso {
  return {
    xpTotal: e.xpTotal + xp,
    xpPorDia: podar({ ...e.xpPorDia, [hoy]: xpHoy(e, hoy) + xp }, hoy),
    leccionesPorDia: podar({ ...e.leccionesPorDia, [hoy]: leccionesHoy(e, hoy) + 1 }, hoy),
  };
}
