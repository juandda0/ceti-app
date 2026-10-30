/**
 * Carga lo que la Bitácora y las Notas necesitan de una clase: el reporte (el
 * mismo de su tablero), el progreso por mundo, las asignaciones y los nombres de
 * mundo de la clase (con los cambios del profe). Reusa los repositorios del
 * tablero sin cambiarlos.
 */
import { sigueEnClase } from '@features/dashboard/data/estadoRoster';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { worldProgressRepository } from '@features/dashboard/data/worldProgressRepository';
import { asignacionRepository } from '@features/dashboard/data/asignacionRepository';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { buildCourseReport, type CourseReport } from '@features/dashboard/data/courseReport';
import { displayWorldDef } from '@features/learning/data/worldMeta';
import type { AsignacionAny } from '@shared/types/tenancy';
import type { ProgresoMundo } from './bitacoraCursos';

export interface CursoDetalle {
  report: CourseReport;
  progreso: ProgresoMundo[];
  asignaciones: AsignacionAny[];
  nombreMundo: (worldId: string) => string;
}

export async function cargarCursoDetalle(
  colegioId: string,
  cursoId: string,
  cursoNombre: string,
  ahora: number
): Promise<CursoDetalle> {
  const [lista, asignaciones, config] = await Promise.all([
    rosterRepository.getRoster(colegioId, cursoId),
    asignacionRepository.listByCurso(colegioId, cursoId).catch(() => []),
    classConfigRepository.get(colegioId, cursoId).catch(() => null),
  ]);
  // Los retirados y suprimidos ya no son parte de la clase.
  const roster = lista.filter((s) => sigueEnClase(s.estado));
  const progreso = (
    await Promise.all(
      roster.map((s) => worldProgressRepository.getStudentProgress(colegioId, cursoId, s.uid))
    )
  ).flat();
  const report = buildCourseReport({
    colegioId,
    cursoId,
    cursoNombre,
    now: ahora,
    roster: roster.map((s) => ({ uid: s.uid, nombre: s.nombre, estado: s.estado })),
    progress: progreso,
  });
  const entradas = new Map((config?.mundos ?? []).map((m) => [m.worldId, m]));
  const nombreMundo = (worldId: string) =>
    displayWorldDef(worldId, entradas.get(worldId))?.name ?? worldId;
  return { report, progreso, asignaciones, nombreMundo };
}
