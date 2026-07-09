/**
 * Loads the school-wide aggregate report for the profesor (D-PIVOT).
 *
 * The profesor is DENIED nominal collection-group progress outside their own
 * courses (firestore.rules, matriz §1.3), but MAY read the per-course
 * `agregados/resumen` across the whole colegio (written by the
 * onProgressWriteAggregate Function). So the school report is built purely from
 * those non-nominal aggregates — zero individual minor data.
 */
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { agregadosRepository } from '@features/dashboard/data/agregadosRepository';
import {
  buildSchoolReportFromAggregates,
  type SchoolReport,
} from '@features/dashboard/data/schoolReport';

export async function loadSchoolReport(colegioId: string, now: number): Promise<SchoolReport> {
  const cursos = await rosterRepository.getAllCursos(colegioId);
  const cursoMetas = cursos.map((c) => ({ id: c.id, nombre: c.nombre, grado: c.grado }));

  const resumenes = await Promise.all(
    cursoMetas.map(async (c) => ({
      cursoId: c.id,
      resumen: await agregadosRepository.getResumen(colegioId, c.id),
    }))
  );
  return buildSchoolReportFromAggregates({ colegioId, now, cursos: cursoMetas, resumenes });
}
