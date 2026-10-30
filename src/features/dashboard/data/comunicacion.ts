/**
 * Fase 5 — mensajes del profe a su clase, del lado de la app. Lo escribe el
 * callable `enviarComunicado` (functions/src/educadores/comunicacion.ts); aquí
 * se juntan anuncios y buzón para la pantalla del estudiante y se resume lo que
 * vio el profe. Puro.
 */
import type {
  ContextoComunicado,
  TipoComunicado,
} from '@/functions/src/educadores/dominio';

/** Un doc de `cursos/{k}/comunicados` (los anuncios los lee también el estudiante). */
export interface Comunicado {
  id: string;
  tipo: TipoComunicado;
  texto: string;
  contexto: ContextoComunicado | null;
  profeNombre: string | null;
  creadoAt: number;
  destinatarios?: number;
  /** Solo en mensajes y comentarios (los lee el profe). */
  para?: string[];
  nombres?: string[];
}

/** Un doc de `estudiantes/{uid}/buzon`. */
export interface MensajeBuzon {
  id: string;
  tipo: Exclude<TipoComunicado, 'anuncio'>;
  texto: string;
  contexto: ContextoComunicado | null;
  profeNombre: string | null;
  creadoAt: number;
  leidoAt: number | null;
}

/** Lo que ve el estudiante: anuncios y lo que le escribieron, del más nuevo al más viejo. */
export interface MensajeDeClase {
  id: string;
  tipo: TipoComunicado;
  texto: string;
  contexto: ContextoComunicado | null;
  profeNombre: string | null;
  creadoAt: number;
  /** Para el estudiante: sus mensajes; los anuncios son de toda la clase. */
  paraMi: boolean;
}

export function mensajesDeClase(
  anuncios: readonly Comunicado[],
  buzon: readonly MensajeBuzon[]
): MensajeDeClase[] {
  return [
    ...anuncios
      .filter((a) => a.tipo === 'anuncio')
      .map((a) => ({
        id: a.id,
        tipo: a.tipo,
        texto: a.texto,
        contexto: null,
        profeNombre: a.profeNombre,
        creadoAt: a.creadoAt,
        paraMi: false,
      })),
    ...buzon.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      texto: m.texto,
      contexto: m.contexto,
      profeNombre: m.profeNombre,
      creadoAt: m.creadoAt,
      paraMi: true,
    })),
  ].sort((a, b) => b.creadoAt - a.creadoAt);
}

/** El nombre del profe que firma la clase: el del mensaje más reciente que lo traiga. */
export function profeDeLaClase(mensajes: readonly { profeNombre: string | null }[]): string | null {
  return mensajes.find((m) => m.profeNombre?.trim())?.profeNombre?.trim() ?? null;
}

/** Destinatarios de un mensaje del profe, para la lista de enviados: "Ana, Beto y 3 más". */
export function resumenDestinatarios(nombres: readonly string[], max = 2): string {
  const primeros = nombres.map((n) => n.trim().split(/\s+/)[0] || n).filter(Boolean);
  if (primeros.length <= max) return primeros.join(' y ');
  return `${primeros.slice(0, max).join(', ')} y ${primeros.length - max} más`;
}

// ── Avisos de la app (`notificaciones/{uid}/items`) ─────────────────────────

export type TipoAviso = 'anuncio' | 'mensaje' | 'retro' | 'alerta';

export interface Aviso {
  id: string;
  tipo: TipoAviso;
  titulo: string;
  cuerpo: string;
  ruta: string;
  colegioId: string;
  cursoId: string;
  datos: Record<string, unknown> | null;
  creadoAt: number;
  leidaAt: number | null;
}

const MAX_TOKENS = 5;

/** Avisos sin leer, opcionalmente de una sola clase. Puro. */
export function sinLeer(avisos: readonly Aviso[], cursoId?: string | null): Aviso[] {
  return avisos.filter((a) => a.leidaAt == null && (cursoId == null || a.cursoId === cursoId));
}

/** Lista de tokens sin repetir, el más nuevo primero, máximo 5. Puro. */
export function agregarToken(actuales: readonly string[], nuevo: string): string[] {
  return [nuevo, ...actuales.filter((t) => t !== nuevo)].slice(0, MAX_TOKENS);
}

// ── Comentarios en la ficha ────────────────────────────────────────────────

/** Sobre qué puede comentar el profe: un mundo de la clase o una tarea de ese mundo. */
export interface OpcionComentario {
  worldId: string;
  nombre: string;
  asignacionId?: string;
  /** Fecha límite de la tarea, si es una tarea. */
  deadline?: number;
}

interface TareaParaComentar {
  id: string;
  kind?: string;
  worldId?: string;
  deadline: number;
  target: { tipo: 'curso' | 'estudiante'; cursoId: string; uid?: string };
}

/**
 * Primero las tareas de mundo que le tocan al estudiante (de toda la clase o
 * suyas), de la más reciente a la más vieja, y después los mundos de la clase
 * que no tienen tarea. Puro.
 */
export function opcionesDeComentario(
  mundos: readonly { id: string; nombre: string }[],
  tareas: readonly TareaParaComentar[],
  uid: string
): OpcionComentario[] {
  const nombre = new Map(mundos.map((m) => [m.id, m.nombre]));
  const suyas = tareas
    .filter((t) => t.kind !== 'reto' && typeof t.worldId === 'string' && nombre.has(t.worldId))
    .filter((t) => t.target.tipo === 'curso' || t.target.uid === uid)
    .sort((a, b) => b.deadline - a.deadline);
  const conTarea = new Set<string>();
  const deTareas: OpcionComentario[] = [];
  for (const t of suyas) {
    if (conTarea.has(t.worldId!)) continue;
    conTarea.add(t.worldId!);
    deTareas.push({
      worldId: t.worldId!,
      nombre: nombre.get(t.worldId!)!,
      asignacionId: t.id,
      deadline: t.deadline,
    });
  }
  return [
    ...deTareas,
    ...mundos.filter((m) => !conTarea.has(m.id)).map((m) => ({ worldId: m.id, nombre: m.nombre })),
  ];
}
