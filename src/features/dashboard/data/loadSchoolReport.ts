/**
 * Loads the school-wide aggregate report (rector/coordinador).
 *
 * The two staff roles take DIFFERENT data paths, dictated by firestore.rules
 * (matriz §1.3):
 *  - `rector` is DENIED nominal collection-group progress; they read the
 *    precomputed `agregados/resumen` per course (written by the
 *    onProgressWriteAggregate Function) — zero nominal data.
 *  - `coordinador`/`admin` ARE allowed the collection-group progress read, so
 *    they go through buildSchoolReport directly (real-time, no aggregate lag).
 *
 * Either way the on-screen report is the same shape — only the source differs.
 */
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { worldProgressRepository } from '@features/dashboard/data/worldProgressRepository';
import { agregadosRepository } from '@features/dashboard/data/agregadosRepository';
import {
  buildSchoolReport,
  buildSchoolReportFromAggregates,
  type SchoolReport,
} from '@features/dashboard/data/schoolReport';
import type { Role } from '@shared/types/tenancy';

export async function loadSchoolReport(
  colegioId: string,
  now: number,
  role?: Role | null
): Promise<SchoolReport> {
  const cursos = await rosterRepository.getAllCursos(colegioId);
  const cursoMetas = cursos.map((c) => ({ id: c.id, nombre: c.nombre, grado: c.grado }));

  // Rector: aggregates only (nominal progress is denied by rules).
  if (role === 'rector') {
    const resumenes = await Promise.all(
      cursoMetas.map(async (c) => ({
        cursoId: c.id,
        resumen: await agregadosRepository.getResumen(colegioId, c.id),
      }))
    );
    return buildSchoolReportFromAggregates({ colegioId, now, cursos: cursoMetas, resumenes });
  }

  // Coordinador / admin: collection-group progress read is permitted by rules.
  const progress = await worldProgressRepository.getColegioProgress(colegioId);
  return buildSchoolReport({ colegioId, now, cursos: cursoMetas, progress });
}
