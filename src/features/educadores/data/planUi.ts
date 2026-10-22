/**
 * Piezas puras que comparten las pantallas de planes, el muro y el bloqueo:
 * por qué apareció el muro (motivo), qué plan lo resuelve, cómo leer los
 * errores de límite del servidor, fechas y el WhatsApp de soporte.
 */
import {
  FUNCIONES,
  PLANES,
  planMinimoPara,
  type Funcion,
  type PlanId,
} from '@/functions/src/educadores/dominio';

/** Razón por la que se abre el muro o la pantalla de planes. */
export type Motivo = Funcion | 'clases' | 'ia' | 'estudiantes';

export function esMotivo(v: unknown): v is Motivo {
  return (
    typeof v === 'string' &&
    (v === 'clases' ||
      v === 'ia' ||
      v === 'estudiantes' ||
      (FUNCIONES as readonly string[]).includes(v))
  );
}

export function esFuncion(v: Motivo): v is Funcion {
  return (FUNCIONES as readonly string[]).includes(v);
}

/**
 * El plan que resuelve el motivo para quien hoy tiene `actual`. Más IA o más
 * estudiantes desde Piloto llevan a Comandante o a Nave; lo demás, al plan más
 * barato que lo incluye.
 */
export function planParaMotivo(motivo: Motivo, actual: PlanId): PlanId {
  if (esFuncion(motivo)) return planMinimoPara(motivo);
  if (motivo === 'clases') return 'piloto';
  if (motivo === 'ia') {
    return PLANES[actual].limites.iaGeneracionesMes > 0 ? 'comandante' : 'piloto';
  }
  // Estudiantes: Cadete → Piloto (más cupo); en Piloto o más, el cupo grande es Nave.
  return actual === 'cadete' ? 'piloto' : 'nave';
}

/** Códigos que manda el servidor en `HttpsError.details.codigo`. */
export const CODIGOS_LIMITE = [
  'limite_clases',
  'limite_estudiantes',
  'requiere_plan',
  'limite_ia',
] as const;
export type CodigoLimite = (typeof CODIGOS_LIMITE)[number];

/** Lee `details.codigo` de un error de callable (o null si no es de límite). */
export function codigoLimite(e: unknown): CodigoLimite | null {
  if (!e || typeof e !== 'object') return null;
  const details = (e as { details?: unknown }).details;
  const codigo =
    details && typeof details === 'object' ? (details as { codigo?: unknown }).codigo : undefined;
  return typeof codigo === 'string' && (CODIGOS_LIMITE as readonly string[]).includes(codigo)
    ? (codigo as CodigoLimite)
    : null;
}

/** El motivo del muro que corresponde a un error de límite. */
export function motivoDeError(e: unknown, siRequierePlan: Motivo = 'iaAuthoring'): Motivo | null {
  const codigo = codigoLimite(e);
  if (!codigo) return null;
  if (codigo === 'limite_clases') return 'clases';
  if (codigo === 'limite_estudiantes') return 'estudiantes';
  if (codigo === 'limite_ia') return 'ia';
  // requiere_plan puede traer la función exacta en details.funcion.
  const funcion = (e as { details?: { funcion?: unknown } }).details?.funcion;
  return typeof funcion === 'string' && esMotivo(funcion) ? funcion : siRequierePlan;
}

/** 'YYYY-MM' del instante en hora de Bogotá (clave de `suscripciones/{uid}/uso`). */
export function mesBogota(ms: number): string {
  return new Date(ms - 5 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

/** '22 de octubre' (o con año si no es el actual), en hora de Bogotá. */
export function fechaLarga(ms: number, ahora = Date.now()): string {
  const mismoAnio = new Date(ms).getUTCFullYear() === new Date(ahora).getUTCFullYear();
  return new Date(ms).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    ...(mismoAnio ? null : { year: 'numeric' as const }),
    timeZone: 'America/Bogota',
  });
}

/** Número de WhatsApp de soporte, sin '+' (marcador si no está configurado). */
export const SOPORTE_MARCADOR = '573000000000';

export function numeroSoporte(valor = process.env.EXPO_PUBLIC_SOPORTE_WHATSAPP): string {
  const d = (valor ?? '').replace(/\D/g, '');
  return d.length >= 10 ? d : SOPORTE_MARCADOR;
}

/** '573001234567' → '+57 300 123 4567' (para mostrar y copiar). */
export function formatoNumeroSoporte(numero: string): string {
  const m = /^57(\d{3})(\d{3})(\d{4})$/.exec(numero);
  return m ? `+57 ${m[1]} ${m[2]} ${m[3]}` : `+${numero}`;
}

export function urlWhatsApp(numero: string, texto?: string): string {
  return `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}
