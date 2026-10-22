/**
 * Plan de avisos de Ceti (notificaciones locales). Reglas:
 *
 * - Máximo 1 al día, a la hora que la persona eligió (entre 7 a. m. y 8 p. m.,
 *   así nunca suena de 9 p. m. a 7 a. m.).
 * - Si hoy ya practicó, el de hoy no se programa.
 * - Se programan solo los próximos DIAS_DE_AVISOS días. Cada vez que abre la app
 *   se vuelven a programar; si no la abre, el último es la despedida de Ceti y
 *   después no suena nada más (se pausa sola tras 4 ignorados).
 *
 * Puro: devuelve qué programar; el adaptador de expo-notifications lo ejecuta.
 */
import { sumarDias } from './tiempo';

export const HORA_MIN = 7;
export const HORA_MAX = 20;
export const DIAS_DE_AVISOS = 4;
export const HORA_POR_DEFECTO = 18;

export interface AvisoPlaneado {
  dia: string;
  hora: number;
  /** Clave de i18n del mensaje (orbita.avisos.*). */
  mensaje: string;
  params: Record<string, number>;
}

const MENSAJES = ['orbita.avisos.m1', 'orbita.avisos.m2', 'orbita.avisos.m3'] as const;

export function horaValida(hora: number): number {
  return Math.min(HORA_MAX, Math.max(HORA_MIN, Math.round(hora)));
}

export function planearAvisos(input: {
  hoy: string;
  horaActual: number;
  hora: number;
  practicoHoy: boolean;
  racha: number;
}): AvisoPlaneado[] {
  const hora = horaValida(input.hora);
  const out: AvisoPlaneado[] = [];
  for (let i = 0; i < DIAS_DE_AVISOS; i++) {
    const dia = sumarDias(input.hoy, i);
    if (i === 0 && (input.practicoHoy || input.horaActual >= hora)) continue;
    const ultimo = i === DIAS_DE_AVISOS - 1;
    // El primero habla de la racha en juego; los siguientes ya no la cuentan (se rompió).
    const mensaje = ultimo
      ? 'orbita.avisos.despedida'
      : out.length === 0 && input.racha > 0
        ? 'orbita.avisos.rachaEnRiesgo'
        : MENSAJES[i % MENSAJES.length];
    out.push({ dia, hora, mensaje, params: { racha: input.racha } });
  }
  return out;
}
