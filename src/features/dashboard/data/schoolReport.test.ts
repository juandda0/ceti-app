import {
  buildSchoolReport,
  schoolReportToCsv,
  type CursoMeta,
} from '@features/dashboard/data/schoolReport';
import type { WorldProgress } from '@shared/types/tenancy';

function wp(
  cursoId: string,
  studentId: string,
  competencia: string,
  mastery: number
): WorldProgress {
  return {
    colegioId: 'A',
    cursoId,
    studentId,
    competencia,
    xp: 0,
    nivel: 1,
    mastery,
    quizScores: {},
    badges: [],
    completed: mastery >= 0.8,
    updatedAt: 1,
  };
}

const cursos: CursoMeta[] = [
  { id: 'c1', nombre: '9A', grado: '9' },
  { id: 'c2', nombre: '9B', grado: '9' },
];

const progress = [
  wp('c1', 's1', 'ahorro', 0.8),
  wp('c1', 's2', 'ahorro', 0.6),
  wp('c2', 's3', 'credito', 0.2),
];

const input = { colegioId: 'A', now: 1000, cursos, progress };

describe('buildSchoolReport', () => {
  it('summarizes each course (avg mastery + distinct students)', () => {
    const r = buildSchoolReport(input);
    const c1 = r.courseSummaries.find((c) => c.cursoId === 'c1')!;
    expect(c1.avgMastery).toBeCloseTo(0.7);
    expect(c1.studentsWithData).toBe(2);
  });

  it('computes school-wide competency averages and weakest', () => {
    const r = buildSchoolReport(input);
    expect(r.weakestCompetencia?.competenciaId).toBe('credito');
    expect(r.overallMastery).toBeCloseTo((0.8 + 0.6 + 0.2) / 3);
  });

  it('CSV has a course table and a competency summary', () => {
    const csv = schoolReportToCsv(buildSchoolReport(input));
    expect(csv).toContain('cursoId');
    expect(csv).toContain('competencia,dominioPromedio');
    expect(csv).toContain('9A');
  });
});
