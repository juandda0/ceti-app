/**
 * Fase 5 — comunicación del profe con su clase. Solo va del profe al estudiante:
 * no hay respuesta ni chat (son menores; decisión del dueño 2026-10-30).
 *
 * - anuncio: a toda la clase. Todos los planes.
 * - mensaje: a uno o varios estudiantes (también "Escribirle a los que…").
 * - retro: comentario de retroalimentación a un estudiante sobre un mundo o una
 *   tarea; se ve en su ficha.
 *
 * Puro: valida lo que manda el cliente y arma el texto de la notificación. El
 * servidor (comunicacion.ts) escribe con el Admin SDK.
 */
import type { Funcion } from './planes';

export const TIPOS_COMUNICADO = ['anuncio', 'mensaje', 'retro'] as const;
export type TipoComunicado = (typeof TIPOS_COMUNICADO)[number];

export const TEXTO_COMUNICADO_MAX = 1000;
/** Destinatarios de un mensaje: una clase llena del plan más grande. */
export const MAX_DESTINATARIOS = 60;
/** Comunicados por clase en 24 h (anuncios + mensajes + comentarios). */
export const TOPE_COMUNICADOS_DIA = 40;
export const NOMBRE_CONTEXTO_MAX = 80;

export interface ContextoComunicado {
  /** Mundo del comentario (retro) o de la tarea. */
  worldId?: string;
  asignacionId?: string;
  /** Nombre del mundo tal como lo ve la clase, para mostrarlo sin buscarlo. */
  nombre?: string;
}

export interface PedidoComunicado {
  tipo: TipoComunicado;
  texto: string;
  /** Destinatarios (uids). Vacío en un anuncio. */
  para: string[];
  contexto: ContextoComunicado | null;
}

export type ErrorComunicado =
  | 'tipo_invalido'
  | 'texto_vacio'
  | 'texto_largo'
  | 'sin_destinatarios'
  | 'demasiados_destinatarios'
  | 'retro_a_uno';

export const MENSAJES_ERROR_COMUNICADO: Record<ErrorComunicado, string> = {
  tipo_invalido: 'Ese tipo de mensaje no existe.',
  texto_vacio: 'Escribe el mensaje antes de enviarlo.',
  texto_largo: `El mensaje puede tener hasta ${TEXTO_COMUNICADO_MAX} caracteres.`,
  sin_destinatarios: 'Elige al menos un estudiante.',
  demasiados_destinatarios: `Puedes escribirle a hasta ${MAX_DESTINATARIOS} estudiantes a la vez.`,
  retro_a_uno: 'Un comentario va a un solo estudiante.',
};

export function esTipoComunicado(v: unknown): v is TipoComunicado {
  return typeof v === 'string' && (TIPOS_COMUNICADO as readonly string[]).includes(v);
}

/** Saltos de línea normales, sin espacios de sobra ni más de una línea en blanco. */
export function limpiarTexto(texto: string): string {
  return texto
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const idValido = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 128 && !v.includes('/');

function leerContexto(v: unknown): ContextoComunicado | null {
  if (!v || typeof v !== 'object') return null;
  const c = v as Record<string, unknown>;
  const out: ContextoComunicado = {};
  if (idValido(c.worldId) && c.worldId.length <= 60) out.worldId = c.worldId;
  if (idValido(c.asignacionId)) out.asignacionId = c.asignacionId;
  if (typeof c.nombre === 'string' && c.nombre.trim()) {
    out.nombre = c.nombre.trim().slice(0, NOMBRE_CONTEXTO_MAX);
  }
  return out.worldId || out.asignacionId ? out : null;
}

/** Lee y valida el pedido del cliente. */
export function leerPedidoComunicado(
  data: unknown
): { ok: true; pedido: PedidoComunicado } | { ok: false; error: ErrorComunicado } {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  if (!esTipoComunicado(d.tipo)) return { ok: false, error: 'tipo_invalido' };
  const texto = limpiarTexto(typeof d.texto === 'string' ? d.texto : '');
  if (!texto) return { ok: false, error: 'texto_vacio' };
  if (texto.length > TEXTO_COMUNICADO_MAX) return { ok: false, error: 'texto_largo' };

  const para =
    d.tipo === 'anuncio'
      ? []
      : [...new Set((Array.isArray(d.para) ? d.para : []).filter(idValido))];
  if (d.tipo !== 'anuncio') {
    if (para.length === 0) return { ok: false, error: 'sin_destinatarios' };
    if (para.length > MAX_DESTINATARIOS) return { ok: false, error: 'demasiados_destinatarios' };
    if (d.tipo === 'retro' && para.length !== 1) return { ok: false, error: 'retro_a_uno' };
  }
  return {
    ok: true,
    pedido: {
      tipo: d.tipo,
      texto,
      para,
      contexto: d.tipo === 'anuncio' ? null : leerContexto(d.contexto),
    },
  };
}

/** Función del plan que hace falta para enviar este tipo (null = todos los planes). */
export function funcionDeComunicado(tipo: TipoComunicado): Funcion | null {
  return tipo === 'anuncio' ? null : 'mensajesProfe';
}

/** Recorte para la vista previa de una notificación. */
export function vistaPrevia(texto: string, max = 120): string {
  const una = texto.replace(/\s+/g, ' ').trim();
  return una.length <= max ? una : `${una.slice(0, max - 1).trimEnd()}…`;
}

/** Título de la notificación que recibe el estudiante. */
export function tituloParaEstudiante(
  tipo: TipoComunicado,
  clase: string,
  contexto: ContextoComunicado | null
): string {
  const deClase = clase.trim() || 'tu clase';
  if (tipo === 'anuncio') return `Anuncio de ${deClase}`;
  if (tipo === 'retro') {
    return contexto?.nombre
      ? `Tu profe comentó tu avance en ${contexto.nombre}`
      : `Tu profe de ${deClase} comentó tu avance`;
  }
  return `Mensaje de tu profe de ${deClase}`;
}
