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

export interface CursoMeta {
  id: string;
  nombre: string;
  grado: string;
  /** Sede this course belongs to (V2). Undefined = sin sede (single implicit). */
  sedeId?: string;
}

export interface CourseSummary {
  cursoId: string;
  nombre: string;
  grado: string;
  sedeId: string | null;
  avgMastery: number;
  studentsWithData: number;
}

/** Per-sede roll-up (V2 sede dashboard). `sedeId` null groups courses without a sede. */
export interface SedeSummary {
  sedeId: string | null;
  courseCount: number;
  avgMastery: number;
  studentsWithData: number;
}

export interface SchoolReport {
  colegioId: string;
  generatedAt: number;
  competencyAverages: CompetencyAverage[];
  courseSummaries: CourseSummary[];
  /** Per-sede aggregates (empty when no course has a sede assigned). */
  sedeSummaries: SedeSummary[];
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
      sedeId: c.sedeId ?? null,
      avgMastery: average(cursoProgress.map((p) => p.mastery)),
      studentsWithData: new Set(cursoProgress.map((p) => p.uid)).size,
    };
  });

  // Per-sede roll-up (V2). Empty unless at least one course has a sede assigned.
  // Sedes are dormant (RQ-FN01) so this stays an optional passthrough on the curso.
  // TODO(RQ-IN02 / Block 6): replace sede grouping with the institutional redesign
  // (aggregate by grado/curso) once sedes are formally retired.
  const anySede = input.cursos.some((c) => c.sedeId != null);
  const sedeSummaries: SedeSummary[] = anySede
    ? Array.from(new Set(input.cursos.map((c) => c.sedeId ?? null))).map((key) => {
        const cursoIds = new Set(
          input.cursos.filter((c) => (c.sedeId ?? null) === key).map((c) => c.id)
        );
        const sedeProgress = input.progress.filter((p) => cursoIds.has(p.cursoId));
        return {
          sedeId: key,
          courseCount: cursoIds.size,
          avgMastery: average(sedeProgress.map((p) => p.mastery)),
          studentsWithData: new Set(sedeProgress.map((p) => p.uid)).size,
        };
      })
    : [];

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
    sedeSummaries,
    weakestCompetencia,
    overallMastery: average(input.progress.map((p) => p.mastery)),
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
