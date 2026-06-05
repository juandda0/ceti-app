/**
 * Course report aggregation — the teacher-facing value: per-student mastery by
 * competency, course averages, and a rule-based "weakest competency" so the
 * teacher gets the diagnosis without doing it by hand. Pure & testable.
 */
import { ALL_COMPETENCIAS, competenciaLabel } from '@features/learning/data/competencias';
import type { EstudianteEstado, WorldProgress } from '@shared/types/tenancy';

/** mastery 0..1 → integer percent 0..100. */
function toPct(mastery: number): number {
  return Math.round(mastery * 100);
}

export interface RosterEntry {
  uid: string;
  nombre: string;
  estado: EstudianteEstado;
}

export interface StudentReportRow {
  uid: string;
  nombre: string;
  estado: EstudianteEstado;
  /** competenciaId → mastery 0..1 (only competencies with data). */
  masteryByCompetencia: Record<string, number>;
  /** Average mastery across competencies with data (0 if none). */
  overallMastery: number;
  /** Most recent progress timestamp (ms), or null if no activity. Feeds early-warning. */
  lastActivity: number | null;
}

export interface CompetencyAverage {
  competenciaId: string;
  label: string;
  averageMastery: number;
  studentsWithData: number;
}

export interface CourseReport {
  colegioId: string;
  cursoId: string;
  cursoNombre: string;
  generatedAt: number;
  students: StudentReportRow[];
  competencyAverages: CompetencyAverage[];
  /** Lowest-average competency with data — "where the course is weak". */
  weakestCompetencia: CompetencyAverage | null;
}

export interface BuildCourseReportInput {
  colegioId: string;
  cursoId: string;
  cursoNombre: string;
  now: number;
  roster: RosterEntry[];
  progress: WorldProgress[];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function buildCourseReport(input: BuildCourseReportInput): CourseReport {
  const progressByStudent = new Map<string, WorldProgress[]>();
  for (const p of input.progress) {
    const list = progressByStudent.get(p.uid) ?? [];
    list.push(p);
    progressByStudent.set(p.uid, list);
  }

  const students: StudentReportRow[] = input.roster.map((entry) => {
    const studentProgress = progressByStudent.get(entry.uid) ?? [];
    const masteryByCompetencia: Record<string, number> = {};
    for (const p of studentProgress) {
      masteryByCompetencia[p.competencia] = p.mastery;
    }
    const values = Object.values(masteryByCompetencia);
    return {
      uid: entry.uid,
      nombre: entry.nombre,
      estado: entry.estado,
      masteryByCompetencia,
      overallMastery: average(values),
      lastActivity: studentProgress.length
        ? Math.max(...studentProgress.map((p) => p.updatedAt))
        : null,
    };
  });

  const competencyAverages: CompetencyAverage[] = ALL_COMPETENCIAS.map((comp) => {
    const withData = students
      .map((s) => s.masteryByCompetencia[comp.id])
      .filter((m): m is number => typeof m === 'number');
    return {
      competenciaId: comp.id,
      label: comp.label,
      averageMastery: average(withData),
      studentsWithData: withData.length,
    };
  });

  const withData = competencyAverages.filter((c) => c.studentsWithData > 0);
  const weakestCompetencia =
    withData.length === 0
      ? null
      : withData.reduce((min, c) => (c.averageMastery < min.averageMastery ? c : min));

  return {
    colegioId: input.colegioId,
    cursoId: input.cursoId,
    cursoNombre: input.cursoNombre,
    generatedAt: input.now,
    students,
    competencyAverages,
    weakestCompetencia,
  };
}

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Flat CSV: one row per student, one mastery-% column per competency, plus an
 * overall column. Columns follow ALL_COMPETENCIAS order (stable).
 */
export function courseReportToCsv(report: CourseReport): string {
  const compCols = ALL_COMPETENCIAS;
  const header = [
    'uid',
    'estudiante',
    'estado',
    ...compCols.map((c) => competenciaLabel(c.id)),
    'global',
  ];
  const rows = report.students.map((s) => [
    csvField(s.uid),
    csvField(s.nombre),
    csvField(s.estado),
    ...compCols.map((c) =>
      typeof s.masteryByCompetencia[c.id] === 'number'
        ? csvField(toPct(s.masteryByCompetencia[c.id]))
        : ''
    ),
    csvField(toPct(s.overallMastery)),
  ]);
  return [header.map(csvField).join(','), ...rows.map((r) => r.join(','))].join('\n');
}
