/**
 * Economía de Cetis. Los Cetis se ganan aprendiendo, se guardan en la Bóveda
 * (que paga interés) y se gastan en escudos. Nunca se compran ni se cambian
 * por plata real.
 *
 * Inflación de Saturno: cada temporada (8 semanas desde EPOCA_TEMPORADAS) los
 * precios y las recompensas suben 5 %. Quien guarda Cetis quietos en el
 * bolsillo pierde poder de compra; la Bóveda le gana a la inflación. Puro.
 */
import { diasEntre } from './tiempo';

/** Primer lunes de la temporada 0. */
export const EPOCA_TEMPORADAS = '2026-11-02';
export const SEMANAS_POR_TEMPORADA = 8;
export const INFLACION_POR_TEMPORADA = 0.05;

const DIAS_TEMPORADA = SEMANAS_POR_TEMPORADA * 7;

export const RECOMPENSAS = {
  leccion: 10,
  leccionPerfecta: 5,
  jefe: 25,
  jefePerfecto: 10,
  metaCumplida: 10,
  primerVuelo: 20,
  hitoRacha: { 7: 50, 30: 150, 100: 500, 365: 1500 } as Record<number, number>,
} as const;

export const PRECIOS = { escudo: 60 } as const;

export function temporadaDe(hoy: string): number {
  return Math.max(0, Math.floor(diasEntre(EPOCA_TEMPORADAS, hoy) / DIAS_TEMPORADA));
}

/** Índice de precios: 1, 1,05, 1,1025… según la temporada. */
export function indicePrecios(hoy: string): number {
  return Math.pow(1 + INFLACION_POR_TEMPORADA, temporadaDe(hoy));
}

/** Días que faltan para la próxima inflación de Saturno. */
export function diasParaInflacion(hoy: string): number {
  const transcurridos = diasEntre(EPOCA_TEMPORADAS, hoy);
  // La época abre la temporada 0 (sin subida); la primera inflación llega 8 semanas después.
  if (transcurridos < 0) return -transcurridos + DIAS_TEMPORADA;
  return DIAS_TEMPORADA - (transcurridos % DIAS_TEMPORADA);
}

/** Valor base ajustado por la inflación vigente. */
export function ajustado(base: number, hoy: string): number {
  return Math.round(base * indicePrecios(hoy));
}

export function precioEscudo(hoy: string): number {
  return ajustado(PRECIOS.escudo, hoy);
}
