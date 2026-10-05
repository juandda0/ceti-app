/**
 * Loads a course's report from the backend: roster + each student's tenant-tree
 * progress (aggregated by buildCourseReport), plus the course's reto prompts.
 * Individual reto progress stays private on each student's device.
 */
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { worldProgressRepository } from '@features/dashboard/data/worldProgressRepository';
import { asignacionRepository } from '@features/dashboard/data/asignacionRepository';
import {
  buildCourseReport,
  type CourseReport,
  type RosterEntry,
} from '@features/dashboard/data/courseReport';
import type { RetoFinancieroTipo } from '@shared/types/tenancy';

export interface RetoColumn {
  id: string;
  tipo: RetoFinancieroTipo;
  cantidad: number;
  deadline: number;
}

export interface CourseReportWithRetos extends CourseReport {
  retoColumns: RetoColumn[];
}

export async function loadCourseReport(
  colegioId: string,
  cursoId: string,
  cursoNombre: string,
  now: number
): Promise<CourseReportWithRetos> {
  const roster = await rosterRepository.getRoster(colegioId, cursoId);
  const progressArrays = await Promise.all(
    roster.map((s) => worldProgressRepository.getStudentProgress(colegioId, cursoId, s.uid))
  );
  const rosterEntries: RosterEntry[] = roster.map((s) => ({
    uid: s.uid,
    nombre: s.nombre,
    estado: s.estado,
  }));
  const base = buildCourseReport({
    colegioId,
    cursoId,
    cursoNombre,
    now,
    roster: rosterEntries,
    progress: progressArrays.flat(),
  });

  const asignaciones = await asignacionRepository.listByCurso(colegioId, cursoId);
  const retoColumns: RetoColumn[] = [];
  for (const a of asignaciones) {
    if (a.kind === 'reto') {
      retoColumns.push({
        id: a.id,
        tipo: a.reto.tipo,
        cantidad: a.reto.cantidad,
        deadline: a.deadline,
      });
    }
  }
  retoColumns.sort((x, y) => x.deadline - y.deadline);

  return { ...base, retoColumns };
}
