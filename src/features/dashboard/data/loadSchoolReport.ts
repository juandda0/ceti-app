/**
 * Loads the school-wide aggregate report for the profesor (D-PIVOT).
 *
 * The profesor is DENIED nominal collection-group progress outside their own
 * courses (firestore.rules, matriz §1.3), but MAY read the per-course
 * `agregados/resumen` across the whole colegio (written by the
 * onProgressWriteAggregate Function). So the school report is built purely from
 * those non-nominal aggregates — zero individual minor data.
 *
 * Which courses exist comes from the server's adoption aggregate
 * (`agregados/adopcion.listaCursos`): the profesor can't list other teachers'
 * courses (the course doc holds the join code). Before that aggregate exists,
 * an admin can still list them all and a profesor falls back to their own.
 */
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { agregadosRepository } from '@features/dashboard/data/agregadosRepository';
import { adopcionRepository } from '@features/educadores/retencion/data/adopcionRepository';
import {
  buildSchoolReportFromAggregates,
  type CursoMeta,
  type SchoolReport,
} from '@features/dashboard/data/schoolReport';

async function cursosDelColegio(colegioId: string, uid: string | null): Promise<CursoMeta[]> {
  const delServidor = await adopcionRepository.leerCursos(colegioId).catch(() => null);
  if (delServidor) return delServidor;
  const cursos = await rosterRepository
    .getAllCursos(colegioId)
    .catch(() => (uid ? rosterRepository.getCursosByProfesor(colegioId, uid) : []));
  return cursos.map((c) => ({ id: c.id, nombre: c.nombre, grado: c.grado }));
}

export async function loadSchoolReport(
  colegioId: string,
  now: number,
  uid: string | null = null
): Promise<SchoolReport> {
  const cursoMetas = await cursosDelColegio(colegioId, uid);

  const resumenes = await Promise.all(
    cursoMetas.map(async (c) => ({
      cursoId: c.id,
      resumen: await agregadosRepository.getResumen(colegioId, c.id).catch(() => null),
    }))
  );
  return buildSchoolReportFromAggregates({ colegioId, now, cursos: cursoMetas, resumenes });
}
