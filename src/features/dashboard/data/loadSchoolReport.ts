/**
 * Loads the school-wide aggregate report (rector/coordinador): all courses +
 * collection-group progress for the colegio, aggregated by buildSchoolReport.
 */
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { worldProgressRepository } from '@features/dashboard/data/worldProgressRepository';
import { buildSchoolReport, type SchoolReport } from '@features/dashboard/data/schoolReport';

/**
 * @param sedeFilter when set (e.g. a coordinador scoped to a sede), restricts the
 *   report to courses of that sede and their progress.
 */
export async function loadSchoolReport(
  colegioId: string,
  now: number,
  sedeFilter?: string
): Promise<SchoolReport> {
  const [cursos, progress] = await Promise.all([
    rosterRepository.getAllCursos(colegioId),
    worldProgressRepository.getColegioProgress(colegioId),
  ]);
  let cursoMetas = cursos.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    grado: c.grado,
    sedeId: c.sedeId,
  }));
  let scopedProgress = progress;
  if (sedeFilter) {
    const ids = new Set(cursoMetas.filter((c) => c.sedeId === sedeFilter).map((c) => c.id));
    cursoMetas = cursoMetas.filter((c) => ids.has(c.id));
    scopedProgress = progress.filter((p) => ids.has(p.cursoId));
  }
  return buildSchoolReport({ colegioId, now, cursos: cursoMetas, progress: scopedProgress });
}
