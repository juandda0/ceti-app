/**
 * Loads the school-wide aggregate report (rector/coordinador): all courses +
 * collection-group progress for the colegio, aggregated by buildSchoolReport.
 */
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { worldProgressRepository } from '@features/dashboard/data/worldProgressRepository';
import { buildSchoolReport, type SchoolReport } from '@features/dashboard/data/schoolReport';

export async function loadSchoolReport(colegioId: string, now: number): Promise<SchoolReport> {
  const [cursos, progress] = await Promise.all([
    rosterRepository.getAllCursos(colegioId),
    worldProgressRepository.getColegioProgress(colegioId),
  ]);
  return buildSchoolReport({
    colegioId,
    now,
    cursos: cursos.map((c) => ({ id: c.id, nombre: c.nombre, grado: c.grado })),
    progress,
  });
}
