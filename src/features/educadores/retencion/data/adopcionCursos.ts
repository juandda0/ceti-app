/**
 * Del colegio a `CursoAdopcion` (dominio): profes, estudiantes y actividad de
 * cada curso, solo con agregados. Nunca toca un perfil individual. Puro.
 */
import {
  DIAS_ACTIVO,
  DIA_MS,
  type Adopcion,
  type CursoAdopcion,
} from '@/functions/src/educadores/dominio';
import type { ResumenAgregado } from '@features/dashboard/data/agregadosRepository';

/**
 * El resumen puede traer, si el servidor ya los calcula, el total de la lista y
 * los activos de los últimos 30 días. Mientras no, se aproxima con lo que hay.
 */
export type ResumenAdopcion = ResumenAgregado & {
  estudiantesTotal?: number;
  estudiantesActivos30d?: number;
};

export interface CursoColegio {
  id: string;
  profesorUids: string[];
  resumen: ResumenAdopcion | null;
  /** Tamaño de la lista si el profe puede leerla (sus propias clases); si no, null. */
  totalLista: number | null;
}

/** `actualizadoAt` llega como Timestamp de Firestore, número o nada. */
export function msDeMarca(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v && typeof v === 'object') {
    const o = v as { toMillis?: () => number; seconds?: number };
    if (typeof o.toMillis === 'function') return o.toMillis();
    if (typeof o.seconds === 'number') return o.seconds * 1000;
  }
  return null;
}

/**
 * - estudiantes: el total de la lista (servidor o lista propia); si no se
 *   conoce, los que tienen progreso.
 * - estudiantesActivos: los activos en 30 días si el servidor los da; si no,
 *   los que tienen progreso, siempre que el curso se haya movido en 30 días.
 * - ultimaActividad: la última vez que se recalculó el agregado (cada avance de
 *   un estudiante lo recalcula).
 */
export function cursosAdopcionDesdeColegio(cursos: CursoColegio[], ahora: number): CursoAdopcion[] {
  const desde = ahora - DIAS_ACTIVO * DIA_MS;
  return cursos.map((c) => {
    const r = c.resumen;
    const ultimaActividad = r ? msDeMarca(r.actualizadoAt) : null;
    const conProgreso = r?.estudiantesActivos ?? 0;
    const estudiantes = r?.estudiantesTotal ?? c.totalLista ?? conProgreso;
    const reciente = ultimaActividad !== null && ultimaActividad >= desde;
    const activos = r?.estudiantesActivos30d ?? (reciente ? conProgreso : 0);
    return {
      profesorUids: c.profesorUids,
      estudiantes,
      estudiantesActivos: Math.min(activos, estudiantes),
      ultimaActividad,
    };
  });
}

/** La adopción que muestra el panel, con la hora del cálculo si vino del servidor. */
export type AdopcionPanel = Adopcion & { actualizadoAt: number | null };

const cifra = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;

/**
 * El doc `colegios/{cid}/agregados/adopcion` (lo escribe adopcionColegio.ts en
 * el servidor) a `AdopcionPanel`. Si le falta alguna cifra, null: el panel cae
 * al cálculo con las clases visibles. Lee solo las cifras, nunca otro campo.
 */
export function adopcionDesdeAgregado(d: unknown): AdopcionPanel | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const profes = cifra(o.profes);
  const profesActivos = cifra(o.profesActivos);
  const cursos = cifra(o.cursos);
  const estudiantes = cifra(o.estudiantes);
  const estudiantesActivos = cifra(o.estudiantesActivos);
  const adopcion = cifra(o.adopcion);
  if (
    profes === null ||
    profesActivos === null ||
    cursos === null ||
    estudiantes === null ||
    estudiantesActivos === null ||
    adopcion === null ||
    typeof o.cumpleMeta !== 'boolean' ||
    typeof o.senalNave !== 'boolean'
  ) {
    return null;
  }
  return {
    profes,
    profesActivos,
    cursos,
    estudiantes,
    estudiantesActivos,
    adopcion: Math.min(adopcion, 1),
    cumpleMeta: o.cumpleMeta,
    senalNave: o.senalNave,
    actualizadoAt: msDeMarca(o.actualizadoAt),
  };
}
