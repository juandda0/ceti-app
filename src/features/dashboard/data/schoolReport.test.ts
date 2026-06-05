import {
  buildSchoolReport,
  schoolReportToCsv,
  type CursoMeta,
} from '@features/dashboard/data/schoolReport';
import type { WorldProgress } from '@shared/types/tenancy';

function wp(cursoId: string, uid: string, competencia: string, mastery: number): WorldProgress {
  return {
    colegioId: 'A',
    cursoId,
    uid,
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

  it('groups courses by sede when sedes are assigned (V2)', () => {
    const r = buildSchoolReport({
      colegioId: 'A',
      now: 1,
      cursos: [
        { id: 'c1', nombre: '9A', grado: '9', sedeId: 'norte' },
        { id: 'c2', nombre: '9B', grado: '9', sedeId: 'norte' },
        { id: 'c3', nombre: '10A', grado: '10', sedeId: 'sur' },
      ],
      progress: [
        wp('c1', 's1', 'ahorro', 0.8),
        wp('c2', 's2', 'ahorro', 0.6),
        wp('c3', 's3', 'ahorro', 0.4),
      ],
    });
    const norte = r.sedeSummaries.find((s) => s.sedeId === 'norte')!;
    expect(norte.courseCount).toBe(2);
    expect(norte.studentsWithData).toBe(2);
    expect(norte.avgMastery).toBeCloseTo(0.7);
    const sur = r.sedeSummaries.find((s) => s.sedeId === 'sur')!;
    expect(sur.courseCount).toBe(1);
    expect(sur.avgMastery).toBeCloseTo(0.4);
  });

  it('emits no sede summaries when no course has a sede assigned', () => {
    expect(buildSchoolReport(input).sedeSummaries).toEqual([]);
  });

  it('CSV has a course table and a competency summary', () => {
    const csv = schoolReportToCsv(buildSchoolReport(input));
    expect(csv).toContain('cursoId');
    expect(csv).toContain('competencia,dominioPromedio');
    expect(csv).toContain('9A');
  });
});
