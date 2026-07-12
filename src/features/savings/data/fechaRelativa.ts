/**
 * Resuelve una fecha relativa dicha por voz (offsetDias / diaSemana) a un epoch
 * local anclado al mediodía de Bogotá del día objetivo (RQ-ES11-CA6). La
 * clasificación server-side NUNCA conoce la fecha ni la zona del dispositivo:
 * solo manda el offset y el cliente lo aterriza aquí. Nunca produce fechas
 * futuras. Puro y testeable.
 */
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC-5, sin DST
const MAX_DIAS_ATRAS = 30;

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const;

function partsBogota(epoch: number): { y: number; m: number; d: number; dow: number } {
  const dt = new Date(epoch - BOGOTA_OFFSET_MS);
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth(),
    d: dt.getUTCDate(),
    dow: dt.getUTCDay(),
  };
}

function mediodiaBogota(y: number, m: number, d: number): number {
  return Date.UTC(y, m, d, 12, 0, 0, 0) + BOGOTA_OFFSET_MS;
}

function normaliza(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function clampOffset(offsetDias: number): number {
  const off = Math.trunc(offsetDias);
  if (!Number.isFinite(off) || off > 0) return 0; // nunca futuro; entrada basura → hoy
  return off < -MAX_DIAS_ATRAS ? -MAX_DIAS_ATRAS : off;
}

export function resolverFechaLocal(
  offsetDias: number,
  diaSemana?: string,
  now: number = Date.now()
): number {
  const { y, m, d, dow } = partsBogota(now);
  let off = clampOffset(offsetDias);

  // Un día de la semana nombrado gana al offset: se resuelve al pasado más
  // reciente (dicho un miércoles, "viernes" → 5 días atrás; "miércoles" → hoy).
  if (diaSemana) {
    const target = DIAS.indexOf(normaliza(diaSemana) as (typeof DIAS)[number]);
    if (target >= 0) off = -((dow - target + 7) % 7);
  }

  return mediodiaBogota(y, m, d + off);
}
