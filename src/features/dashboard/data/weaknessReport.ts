/**
 * Rule-based weakness detection (V2) — NO machine learning. Turns a CourseReport
 * into an actionable diagnosis for the teacher: which competencies the course is
 * weak in, which students are at risk, and each at-risk student's weak areas.
 * "Weak" = average/individual mastery below the mastery threshold (0.8). Pure &
 * testable. This is the rules-based "where is the course weak" the MVP deferred.
 */
import { MASTERY_THRESHOLD } from '@features/learning/data/mastery';
import type { CourseReport } from '@features/dashboard/data/courseReport';

export interface CompetencyWeakness {
  competenciaId: string;
  label: string;
  /** Course average mastery for this competency (0..1). */
  averageMastery: number;
  /** Students with any data for this competency. */
  studentsWithData: number;
  /** Of those, how many are below the threshold. */
  studentsBelow: number;
}

export interface StudentWeaknessArea {
  competenciaId: string;
  label: string;
  mastery: number;
}

export interface StudentWeakness {
  uid: string;
  nombre: string;
  overallMastery: number;
  /** Competencies (with data) where this student is below the threshold. */
  weakAreas: StudentWeaknessArea[];
}

export interface WeaknessReport {
  /** Mastery threshold used (0..1). */
  threshold: number;
  /** Competencies whose course average is below the threshold, weakest first. */
  weakCompetencias: CompetencyWeakness[];
  /** Active students whose overall mastery is below the threshold, weakest first. */
  studentsAtRisk: StudentWeakness[];
  /** True when at least one student has any mastery data. */
  hasData: boolean;
}

/**
 * Builds the weakness report from a course report. `threshold` is the mastery
 * cutoff (default = the shared MASTERY_THRESHOLD). Only competencies/students
 * with actual data are considered (no penalising "not started yet").
 */
export function buildWeaknessReport(
  report: CourseReport,
  threshold: number = MASTERY_THRESHOLD
): WeaknessReport {
  const weakCompetencias: CompetencyWeakness[] = report.competencyAverages
    .filter((c) => c.studentsWithData > 0 && c.averageMastery < threshold)
    .map((c) => {
      const studentsBelow = report.students.filter((s) => {
        const m = s.masteryByCompetencia[c.competenciaId];
        return typeof m === 'number' && m < threshold;
      }).length;
      return {
        competenciaId: c.competenciaId,
        label: c.label,
        averageMastery: c.averageMastery,
        studentsWithData: c.studentsWithData,
        studentsBelow,
      };
    })
    .sort((a, b) => a.averageMastery - b.averageMastery);

  const studentsAtRisk: StudentWeakness[] = report.students
    .filter((s) => {
      const hasAny = Object.keys(s.masteryByCompetencia).length > 0;
      return hasAny && s.overallMastery < threshold;
    })
    .map((s) => ({
      uid: s.uid,
      nombre: s.nombre,
      overallMastery: s.overallMastery,
      weakAreas: Object.entries(s.masteryByCompetencia)
        .filter(([, m]) => m < threshold)
        .map(([competenciaId, mastery]) => ({
          competenciaId,
          label:
            report.competencyAverages.find((c) => c.competenciaId === competenciaId)?.label ??
            competenciaId,
          mastery,
        }))
        .sort((a, b) => a.mastery - b.mastery),
    }))
    .sort((a, b) => a.overallMastery - b.overallMastery);

  const hasData = report.students.some((s) => Object.keys(s.masteryByCompetencia).length > 0);

  return { threshold, weakCompetencias, studentsAtRisk, hasData };
}
