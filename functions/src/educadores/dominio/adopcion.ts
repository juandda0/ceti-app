/**
 * Adopción del colegio (E9): lo que un colegio mira para renovar. Profes activos,
 * estudiantes activos y su porcentaje frente a la meta de uso de la garantía de
 * impacto. Solo agregados. Puro.
 */
import { DIA_MS } from './calendario';

export const META_ADOPCION = 0.7;
export const DIAS_ACTIVO = 30;
/** Profes activos del mismo colegio a partir de los cuales se ofrece Nave. */
export const SENAL_COLEGIO_PROFES = 3;

export interface CursoAdopcion {
  profesorUids: string[];
  estudiantes: number;
  /** Estudiantes con actividad en los últimos 30 días. */
  estudiantesActivos: number;
  ultimaActividad: number | null;
}

export interface Adopcion {
  profes: number;
  profesActivos: number;
  cursos: number;
  estudiantes: number;
  estudiantesActivos: number;
  /** 0..1 */
  adopcion: number;
  cumpleMeta: boolean;
  /** ¿Ya conviene ofrecer el plan Nave al colegio? */
  senalNave: boolean;
}

export function calcularAdopcion(cursos: CursoAdopcion[], ahora: number): Adopcion {
  const desde = ahora - DIAS_ACTIVO * DIA_MS;
  const profes = new Set<string>();
  const activos = new Set<string>();
  let estudiantes = 0;
  let estudiantesActivos = 0;
  for (const c of cursos) {
    c.profesorUids.forEach((p) => profes.add(p));
    if (c.ultimaActividad !== null && c.ultimaActividad >= desde) {
      c.profesorUids.forEach((p) => activos.add(p));
    }
    estudiantes += c.estudiantes;
    estudiantesActivos += Math.min(c.estudiantesActivos, c.estudiantes);
  }
  const adopcion = estudiantes === 0 ? 0 : estudiantesActivos / estudiantes;
  return {
    profes: profes.size,
    profesActivos: activos.size,
    cursos: cursos.length,
    estudiantes,
    estudiantesActivos,
    adopcion,
    cumpleMeta: adopcion >= META_ADOPCION,
    senalNave: activos.size >= SENAL_COLEGIO_PROFES,
  };
}
