/**
 * Loads a course's report from Firestore: roster + each student's tenant-tree
 * progress, aggregated by buildCourseReport. Teachers read per-student progress
 * (authorized by the nested isProfesorDe rule), avoiding the rector/coordinador
 * collection-group path.
 */
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { worldProgressRepository } from '@features/dashboard/data/worldProgressRepository';
import {
  buildCourseReport,
  type CourseReport,
  type RosterEntry,
} from '@features/dashboard/data/courseReport';

export async function loadCourseReport(
  colegioId: string,
  cursoId: string,
  cursoNombre: string,
  now: number
): Promise<CourseReport> {
  const roster = await rosterRepository.getRoster(colegioId, cursoId);
  const progressArrays = await Promise.all(
    roster.map((s) => worldProgressRepository.getStudentProgress(colegioId, cursoId, s.uid))
  );
  const rosterEntries: RosterEntry[] = roster.map((s) => ({
    uid: s.uid,
    nombre: s.nombre,
    estado: s.estado,
  }));
  return buildCourseReport({
    colegioId,
    cursoId,
    cursoNombre,
    now,
    roster: rosterEntries,
    progress: progressArrays.flat(),
  });
}
