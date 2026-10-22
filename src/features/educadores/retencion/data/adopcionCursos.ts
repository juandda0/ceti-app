/**
 * Del colegio a `CursoAdopcion` (dominio): profes, estudiantes y actividad de
 * cada curso, solo con agregados. Nunca toca un perfil individual. Puro.
 */
import { DIAS_ACTIVO, DIA_MS, type CursoAdopcion } from '@/functions/src/educadores/dominio';
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
