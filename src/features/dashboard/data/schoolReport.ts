/**
 * School-wide aggregate report for rector/coordinador — the high-level
 * compliance view (distinct from the teacher's per-course operational report).
 * This is the contract-renewal argument: "the school is covering CONPES 4005".
 * Pure & testable; fed by the collection-group progress query (rector/coordinador
 * only per firestore.rules).
 */
import { ALL_COMPETENCIAS, competenciaLabel } from '@features/learning/data/competencias';
import type { CompetencyAverage } from '@features/dashboard/data/courseReport';
import type { WorldProgress } from '@shared/types/tenancy';
import type { ResumenAgregado } from '@features/dashboard/data/agregadosRepository';

export interface CursoMeta {
  id: string;
  nombre: string;
  grado: string;
}

export interface CourseSummary {
  cursoId: string;
  nombre: string;
  grado: string;
  avgMastery: number;
  studentsWithData: number;
}

export interface SchoolReport {
  colegioId: string;
  generatedAt: number;
  competencyAverages: CompetencyAverage[];
  courseSummaries: CourseSummary[];
  weakestCompetencia: CompetencyAverage | null;
  /** School-wide average mastery across all progress records (0..1). */
  overallMastery: number;
}

export interface BuildSchoolReportInput {
  colegioId: string;
  now: number;
  cursos: CursoMeta[];
  progress: WorldProgress[];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function buildSchoolReport(input: BuildSchoolReportInput): SchoolReport {
  const competencyAverages: CompetencyAverage[] = ALL_COMPETENCIAS.map((comp) => {
    const masteries = input.progress.filter((p) => p.competencia === comp.id).map((p) => p.mastery);
    return {
      competenciaId: comp.id,
      label: comp.label,
      averageMastery: average(masteries),
      studentsWithData: new Set(
        input.progress.filter((p) => p.competencia === comp.id).map((p) => p.uid)
      ).size,
    };
  });

  const courseSummaries: CourseSummary[] = input.cursos.map((c) => {
    const cursoProgress = input.progress.filter((p) => p.cursoId === c.id);
    return {
      cursoId: c.id,
      nombre: c.nombre,
      grado: c.grado,
      avgMastery: average(cursoProgress.map((p) => p.mastery)),
      studentsWithData: new Set(cursoProgress.map((p) => p.uid)).size,
    };
  });

  const withData = competencyAverages.filter((c) => c.studentsWithData > 0);
  const weakestCompetencia =
    withData.length === 0
      ? null
      : withData.reduce((min, c) => (c.averageMastery < min.averageMastery ? c : min));

  return {
    colegioId: input.colegioId,
    generatedAt: input.now,
    competencyAverages,
    courseSummaries,
    weakestCompetencia,
    overallMastery: average(input.progress.map((p) => p.mastery)),
  };
}

/**
 * Build the school report from PRECOMPUTED per-course aggregates — the rector's
 * path. The rector is denied nominal collection-group progress by firestore.rules
 * (matriz §1.3); they read `agregados/resumen` per course instead. The aggregates
 * carry ZERO nominal data, so this report exposes only counts and averages.
 *
 * The per-competency average is weighted by the number of students with data on
 * that competency in each course, matching the unweighted-per-student semantics of
 * buildSchoolReport closely enough for a high-level compliance view.
 */
export function buildSchoolReportFromAggregates(input: {
  colegioId: string;
  now: number;
  cursos: CursoMeta[];
  /** Per-course aggregate (null when the course has no progress yet). */
  resumenes: { cursoId: string; resumen: ResumenAgregado | null }[];
}): SchoolReport {
  const byCurso = new Map(input.resumenes.map((r) => [r.cursoId, r.resumen]));

  const courseSummaries: CourseSummary[] = input.cursos.map((c) => {
    const r = byCurso.get(c.id) ?? null;
    return {
      cursoId: c.id,
      nombre: c.nombre,
      grado: c.grado,
      avgMastery: r?.masteryPromedio ?? 0,
      studentsWithData: r?.estudiantesActivos ?? 0,
    };
  });

  const competencyAverages: CompetencyAverage[] = ALL_COMPETENCIAS.map((comp) => {
    // Weight each course's competency average by its #students-with-data so the
    // school-wide number reflects per-student mastery, not per-course.
    let weighted = 0;
    let students = 0;
    for (const { resumen } of input.resumenes) {
      const agg = resumen?.porCompetencia?.[comp.id];
      if (!agg || agg.estudiantes === 0) continue;
      weighted += agg.masteryPromedio * agg.estudiantes;
      students += agg.estudiantes;
    }
    return {
      competenciaId: comp.id,
      label: comp.label,
      averageMastery: students === 0 ? 0 : weighted / students,
      studentsWithData: students,
    };
  });

  // School-wide mastery: weight each course's mastery by its active students.
  let masteryWeighted = 0;
  let activeTotal = 0;
  for (const { resumen } of input.resumenes) {
    if (!resumen || resumen.estudiantesActivos === 0) continue;
    masteryWeighted += resumen.masteryPromedio * resumen.estudiantesActivos;
    activeTotal += resumen.estudiantesActivos;
  }

  const withData = competencyAverages.filter((c) => c.studentsWithData > 0);
  const weakestCompetencia =
    withData.length === 0
      ? null
      : withData.reduce((min, c) => (c.averageMastery < min.averageMastery ? c : min));

  return {
    colegioId: input.colegioId,
    generatedAt: input.now,
    competencyAverages,
    courseSummaries,
    weakestCompetencia,
    overallMastery: activeTotal === 0 ? 0 : masteryWeighted / activeTotal,
  };
}

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV: one row per course (grade, students, avg mastery %) — compliance snapshot. */
export function schoolReportToCsv(report: SchoolReport): string {
  const header = ['cursoId', 'curso', 'grado', 'estudiantes', 'dominioPromedio'];
  const rows = report.courseSummaries.map((c) => [
    csvField(c.cursoId),
    csvField(c.nombre),
    csvField(c.grado),
    csvField(c.studentsWithData),
    csvField(Math.round(c.avgMastery * 100)),
  ]);
  const compSummary = report.competencyAverages.map((c) =>
    [
      csvField(competenciaLabel(c.competenciaId)),
      csvField(Math.round(c.averageMastery * 100)),
    ].join(',')
  );
  return [
    header.join(','),
    ...rows.map((r) => r.join(',')),
    '',
    'competencia,dominioPromedio',
    ...compSummary,
  ].join('\n');
}
