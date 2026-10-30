/**
 * Fase 5 — alertas al profe, calculadas en el servidor una vez al día
 * (alertasProfe.ts) con lo que ya guarda la clase: visitas, `resumen/clase` y
 * las tareas. Tres tipos, cada uno se puede apagar por clase:
 *
 * - inactividad: un estudiante activo no entra a la clase hace N días.
 * - tarea: venció una tarea de mundo y no la hizo.
 * - promedio: el acierto de sus últimas respuestas cayó frente a su promedio.
 *
 * No repite: el estado de lo ya avisado se guarda por profe y clase, y solo se
 * avisa lo nuevo. Puro.
 */
import type { Funcion } from './planes';

const DIA_MS = 24 * 60 * 60 * 1000;

export const FUNCION_ALERTAS: Funcion = 'alertasTempranas';

export const DIAS_INACTIVIDAD_OPCIONES = [3, 5, 7, 10, 14] as const;
export const DIAS_INACTIVIDAD_MIN = 2;
export const DIAS_INACTIVIDAD_MAX = 30;
/** Tareas que vencieron hace más de esto ya no avisan. */
export const VENTANA_TAREAS_MS = 7 * DIA_MS;
/** Respuestas nuevas para medir el promedio reciente, y mínimo para el anterior. */
export const MIN_RESPUESTAS_PROMEDIO = 10;
/** Caída (en fracción) que dispara la alerta: 15 puntos. */
export const CAIDA_PROMEDIO = 0.15;

export type TipoAlerta = 'inactividad' | 'tarea' | 'promedio';

export interface ConfigAlertas {
  inactividad: { activa: boolean; dias: number };
  tarea: { activa: boolean };
  promedio: { activa: boolean };
}

export const CONFIG_ALERTAS_POR_DEFECTO: ConfigAlertas = {
  inactividad: { activa: true, dias: 7 },
  tarea: { activa: true },
  promedio: { activa: true },
};

const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);

/** Lee `config/comunicacion.alertas`; lo que falte o esté mal queda por defecto. */
export function leerConfigAlertas(v: unknown): ConfigAlertas {
  const d = (v && typeof v === 'object' ? v : {}) as Record<string, Record<string, unknown> | undefined>;
  const def = CONFIG_ALERTAS_POR_DEFECTO;
  const dias = d.inactividad?.dias;
  return {
    inactividad: {
      activa: bool(d.inactividad?.activa, def.inactividad.activa),
      dias:
        typeof dias === 'number' && Number.isInteger(dias)
          ? Math.min(DIAS_INACTIVIDAD_MAX, Math.max(DIAS_INACTIVIDAD_MIN, dias))
          : def.inactividad.dias,
    },
    tarea: { activa: bool(d.tarea?.activa, def.tarea.activa) },
    promedio: { activa: bool(d.promedio?.activa, def.promedio.activa) },
  };
}

export function algunaAlertaActiva(c: ConfigAlertas): boolean {
  return c.inactividad.activa || c.tarea.activa || c.promedio.activa;
}

export interface EstudianteParaAlertas {
  uid: string;
  nombre: string;
  /** Cuándo se unió a la clase (ms), si se sabe. */
  unidoAt: number | null;
  /** Última visita o intento en la clase (ms). */
  ultimaActividad: number | null;
  /** Totales de `resumen/clase`. */
  respuestas: number;
  aciertos: number;
}

export interface TareaParaAlertas {
  id: string;
  worldId: string;
  nombreMundo: string;
  deadline: number;
  /** null = toda la clase. */
  uid: string | null;
  /** Quiénes ya conquistaron el mundo. */
  hechos: readonly string[];
}

/** Lo ya avisado, por profe y clase (`notificaciones/{profe}/estadoAlertas/{cursoId}`). */
export interface EstadoAlertas {
  /** uid → la última actividad por la que ya se avisó (0 = nunca entró). */
  inactividad: Record<string, number>;
  /** id de la tarea → uids ya avisados. */
  tareas: Record<string, string[]>;
  /** uid → totales cuando se midió por última vez. */
  promedio: Record<string, { respuestas: number; aciertos: number }>;
}

export const ESTADO_ALERTAS_VACIO: EstadoAlertas = { inactividad: {}, tareas: {}, promedio: {} };

export function leerEstadoAlertas(v: unknown): EstadoAlertas {
  const d = (v && typeof v === 'object' ? v : {}) as Partial<EstadoAlertas>;
  return {
    inactividad: d.inactividad && typeof d.inactividad === 'object' ? { ...d.inactividad } : {},
    tareas: d.tareas && typeof d.tareas === 'object' ? { ...d.tareas } : {},
    promedio: d.promedio && typeof d.promedio === 'object' ? { ...d.promedio } : {},
  };
}

export interface EstudianteAlertado {
  uid: string;
  nombre: string;
}

export interface AlertaNueva {
  tipo: TipoAlerta;
  estudiantes: EstudianteAlertado[];
  /** inactividad: los días configurados. */
  dias?: number;
  /** tarea. */
  asignacionId?: string;
  worldId?: string;
  nombreMundo?: string;
  deadline?: number;
  /** promedio (un estudiante por alerta). */
  antes?: number;
  despues?: number;
  respuestasRecientes?: number;
}

export function calcularAlertas(input: {
  config: ConfigAlertas;
  estudiantes: readonly EstudianteParaAlertas[];
  tareas: readonly TareaParaAlertas[];
  estado: EstadoAlertas;
  ahora: number;
}): { alertas: AlertaNueva[]; estado: EstadoAlertas } {
  const { config, estudiantes, tareas, ahora } = input;
  const enClase = new Map(estudiantes.map((e) => [e.uid, e]));
  const alertas: AlertaNueva[] = [];
  const estado: EstadoAlertas = { inactividad: {}, tareas: {}, promedio: {} };

  // ── Inactividad ────────────────────────────────────────────────────────────
  const inactivos: EstudianteAlertado[] = [];
  for (const e of estudiantes) {
    const ultima = e.ultimaActividad ?? null;
    const desde = Math.max(ultima ?? 0, e.unidoAt ?? 0);
    const previo = input.estado.inactividad[e.uid];
    if (previo !== undefined) estado.inactividad[e.uid] = previo;
    if (!config.inactividad.activa || desde === 0) continue;
    if (ahora - desde < config.inactividad.dias * DIA_MS) continue;
    const clave = ultima ?? 0;
    if (previo === clave) continue;
    estado.inactividad[e.uid] = clave;
    inactivos.push({ uid: e.uid, nombre: e.nombre });
  }
  if (inactivos.length > 0) {
    alertas.push({ tipo: 'inactividad', estudiantes: inactivos, dias: config.inactividad.dias });
  }

  // ── Tareas vencidas sin hacer ──────────────────────────────────────────────
  // Solo las que vencieron hace poco; las demás salen del estado solas.
  for (const t of [...tareas].sort((a, b) => a.deadline - b.deadline)) {
    if (t.deadline > ahora || ahora - t.deadline > VENTANA_TAREAS_MS) continue;
    const ya = new Set(input.estado.tareas[t.id] ?? []);
    const hechos = new Set(t.hechos);
    const deben = t.uid
      ? enClase.has(t.uid)
        ? [enClase.get(t.uid)!]
        : []
      : estudiantes.filter((e) => e.unidoAt == null || e.unidoAt <= t.deadline);
    const nuevos = config.tarea.activa
      ? deben.filter((e) => !hechos.has(e.uid) && !ya.has(e.uid))
      : [];
    estado.tareas[t.id] = [...ya, ...nuevos.map((e) => e.uid)];
    if (nuevos.length > 0) {
      alertas.push({
        tipo: 'tarea',
        estudiantes: nuevos.map((e) => ({ uid: e.uid, nombre: e.nombre })),
        asignacionId: t.id,
        worldId: t.worldId,
        nombreMundo: t.nombreMundo,
        deadline: t.deadline,
      });
    }
  }
  // ── Bajó su promedio ───────────────────────────────────────────────────────
  for (const e of estudiantes) {
    const base = input.estado.promedio[e.uid];
    const actual = { respuestas: e.respuestas, aciertos: e.aciertos };
    if (!base || e.respuestas < base.respuestas) {
      estado.promedio[e.uid] = actual;
      continue;
    }
    const nuevas = e.respuestas - base.respuestas;
    if (nuevas < MIN_RESPUESTAS_PROMEDIO) {
      estado.promedio[e.uid] = base;
      continue;
    }
    estado.promedio[e.uid] = actual;
    if (!config.promedio.activa || base.respuestas < MIN_RESPUESTAS_PROMEDIO) continue;
    const antes = base.aciertos / base.respuestas;
    const despues = Math.max(0, e.aciertos - base.aciertos) / nuevas;
    if (antes - despues >= CAIDA_PROMEDIO) {
      alertas.push({
        tipo: 'promedio',
        estudiantes: [{ uid: e.uid, nombre: e.nombre }],
        antes,
        despues,
        respuestasRecientes: nuevas,
      });
    }
  }

  return { alertas, estado };
}

const primerNombre = (n: string) => n.trim().split(/\s+/)[0] || 'Un estudiante';

/** "Ana", "Ana y Beto", "Ana, Beto y 3 más". */
export function quienes(estudiantes: readonly EstudianteAlertado[]): string {
  const n = estudiantes.map((e) => primerNombre(e.nombre));
  if (n.length <= 2) return n.join(' y ');
  return `${n.slice(0, 2).join(', ')} y ${n.length - 2} más`;
}

const pct = (v: number) => `${Math.round(v * 100)} %`;

/** Título y cuerpo de la notificación al profe. Puro. */
export function textoAlerta(a: AlertaNueva, clase: string): { titulo: string; cuerpo: string } {
  const deClase = clase.trim() || 'tu clase';
  const uno = a.estudiantes.length === 1;
  if (a.tipo === 'inactividad') {
    return {
      titulo: `${quienes(a.estudiantes)} ${uno ? 'lleva' : 'llevan'} ${a.dias} días o más sin entrar`,
      cuerpo: `En ${deClase}. Un mensaje corto suele bastar para que vuelvan.`,
    };
  }
  if (a.tipo === 'tarea') {
    return {
      titulo: uno
        ? `${quienes(a.estudiantes)} no hizo ${a.nombreMundo}`
        : `${a.estudiantes.length} estudiantes no hicieron ${a.nombreMundo}`,
      cuerpo: `La tarea de ${deClase} ya venció${uno ? '' : `: ${quienes(a.estudiantes)}`}.`,
    };
  }
  return {
    titulo: `${quienes(a.estudiantes)} bajó de ${pct(a.antes ?? 0)} a ${pct(a.despues ?? 0)} de aciertos`,
    cuerpo: `En sus últimas ${a.respuestasRecientes} respuestas de ${deClase}.`,
  };
}
