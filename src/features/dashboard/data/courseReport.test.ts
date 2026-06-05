import {
  buildCourseReport,
  courseReportToCsv,
  type RosterEntry,
} from '@features/dashboard/data/courseReport';
import type { WorldProgress } from '@shared/types/tenancy';

function wp(uid: string, competencia: string, mastery: number): WorldProgress {
  return {
    colegioId: 'A',
    cursoId: 'c1',
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

const roster: RosterEntry[] = [
  { uid: 's1', nombre: 'Est 1', estado: 'activo' },
  { uid: 's2', nombre: 'Est 2', estado: 'activo' },
];

const progress = [wp('s1', 'ahorro', 0.8), wp('s1', 'ingreso', 0.4), wp('s2', 'ahorro', 0.6)];

const input = {
  colegioId: 'A',
  cursoId: 'c1',
  cursoNombre: '9A',
  now: 1000,
  roster,
  progress,
};

describe('buildCourseReport', () => {
  it('computes per-student mastery and overall', () => {
    const r = buildCourseReport(input);
    const s1 = r.students.find((s) => s.uid === 's1')!;
    expect(s1.masteryByCompetencia).toEqual({ ahorro: 0.8, ingreso: 0.4 });
    expect(s1.overallMastery).toBeCloseTo(0.6);
  });

  it('computes competency averages across students with data', () => {
    const r = buildCourseReport(input);
    const ahorro = r.competencyAverages.find((c) => c.competenciaId === 'ahorro')!;
    expect(ahorro.averageMastery).toBeCloseTo(0.7);
    expect(ahorro.studentsWithData).toBe(2);
  });

  it('flags the weakest competency with data', () => {
    const r = buildCourseReport(input);
    expect(r.weakestCompetencia?.competenciaId).toBe('ingreso');
  });

  it('returns null weakest when no progress', () => {
    const r = buildCourseReport({ ...input, progress: [] });
    expect(r.weakestCompetencia).toBeNull();
  });
});

describe('courseReportToCsv', () => {
  it('emits a header plus one row per student', () => {
    const csv = courseReportToCsv(buildCourseReport(input));
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1 + roster.length);
    expect(lines[0]).toContain('estudiante');
    expect(lines[0]).toContain('global');
  });
});
