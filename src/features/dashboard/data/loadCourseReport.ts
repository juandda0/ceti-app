/**
 * Loads a course's report from Firestore: roster + each student's tenant-tree
 * progress (aggregated by buildCourseReport), plus the course's reto prompts.
 * Individual reto progress stays private on each student's device.
 */
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { worldProgressRepository } from '@features/dashboard/data/worldProgressRepository';
import { asignacionRepository } from '@features/dashboard/data/asignacionRepository';
import { sigueEnClase } from '@features/dashboard/data/estadoRoster';
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
  // Solo quienes siguen en la clase: los retirados y suprimidos no entran al reporte.
  const roster = (await rosterRepository.getRoster(colegioId, cursoId)).filter((s) =>
    sigueEnClase(s.estado)
  );
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
