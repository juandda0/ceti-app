/**
 * Fase 9 — muro de preguntas de la clase, moderado por el profe. No es un
 * chat (la decisión del 30 de octubre sigue: los mensajes van del profe al
 * estudiante): el estudiante deja una pregunta pública para la clase que nadie
 * ve hasta que un profe la publica, con o sin respuesta. Viene apagado; lo
 * enciende quien edita la clase (`config/muro`). Sin respuestas entre
 * estudiantes y solo el primer nombre. Puro.
 *
 * Datos: `cursos/{k}/muro/{id}` {uid, nombre, texto, estado, creadoAt,
 * respuesta?, respondidaPor?, respondidaPorNombre?, respondidaAt?}.
 */

export const MAX_PREGUNTA_MURO = 280;
export const MAX_RESPUESTA_MURO = 500;
/** Preguntas esperando al profe que puede tener un estudiante. */
export const MAX_PENDIENTES_MURO = 3;
/** Preguntas por estudiante en un día. */
export const MAX_PREGUNTAS_DIA = 10;

export type EstadoPregunta = 'pendiente' | 'publicada' | 'oculta';

export interface PreguntaMuro {
  uid: string;
  nombre: string;
  texto: string;
  estado: EstadoPregunta;
  creadoAt: number;
  respuesta?: string | null;
  respondidaPor?: string | null;
  respondidaPorNombre?: string | null;
  respondidaAt?: number | null;
}

export type ErrorMuro = 'apagado' | 'vacia' | 'larga' | 'pendientes' | 'dia' | 'respuesta';

export const MENSAJES_ERROR_MURO: Record<ErrorMuro, string> = {
  apagado: 'Tu profe no ha abierto el muro de preguntas de esta clase.',
  vacia: 'Escribe tu pregunta.',
  larga: `La pregunta va hasta ${MAX_PREGUNTA_MURO} caracteres.`,
  pendientes: `Ya tienes ${MAX_PENDIENTES_MURO} preguntas esperando a tu profe. Espera a que las revise.`,
  dia: `Por hoy ya hiciste ${MAX_PREGUNTAS_DIA} preguntas. Vuelve mañana.`,
  respuesta: `La respuesta va hasta ${MAX_RESPUESTA_MURO} caracteres.`,
};

/** Texto limpio: sin espacios de más ni más de dos saltos seguidos. */
export function limpiarTextoMuro(v: unknown, max: number): { ok: true; texto: string } | { ok: false; error: 'vacia' | 'larga' } {
  const t = typeof v === 'string' ? v.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : '';
  if (!t) return { ok: false, error: 'vacia' };
  if (t.length > max) return { ok: false, error: 'larga' };
  return { ok: true, texto: t };
}

/** Solo el primer nombre: la clase no ve apellidos. */
export function nombreEnMuro(nombre: string | null | undefined): string {
  const n = (nombre ?? '').trim().split(/\s+/)[0] ?? '';
  return n.slice(0, 30) || 'Estudiante';
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** ¿Puede preguntar otra vez? `mias` = sus preguntas en la clase. */
export function puedePreguntar(
  mias: readonly Pick<PreguntaMuro, 'estado' | 'creadoAt'>[],
  ahora: number
): ErrorMuro | null {
  if (mias.filter((p) => p.estado === 'pendiente').length >= MAX_PENDIENTES_MURO) return 'pendientes';
  if (mias.filter((p) => ahora - p.creadoAt < DIA_MS).length >= MAX_PREGUNTAS_DIA) return 'dia';
  return null;
}

/** Lo que ve un estudiante: las publicadas y las suyas, lo más nuevo arriba. */
export function muroParaEstudiante<T extends Pick<PreguntaMuro, 'uid' | 'estado' | 'creadoAt'>>(preguntas: readonly T[], uid: string): T[] {
  return preguntas
    .filter((p) => p.estado === 'publicada' || (p.uid === uid && p.estado !== 'oculta'))
    .sort((a, b) => b.creadoAt - a.creadoAt);
}
