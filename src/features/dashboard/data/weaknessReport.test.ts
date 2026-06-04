import { buildCourseReport, type RosterEntry } from '@features/dashboard/data/courseReport';
import { buildWeaknessReport } from '@features/dashboard/data/weaknessReport';
import type { WorldProgress } from '@shared/types/tenancy';

function prog(studentId: string, competencia: string, mastery: number): WorldProgress {
  return {
    colegioId: 'A',
    cursoId: 'c1',
    studentId,
    competencia,
    xp: 0,
    nivel: 0,
    mastery,
    quizScores: {},
    badges: [],
    completed: mastery >= 0.8,
    updatedAt: 1,
  };
}

const roster: RosterEntry[] = [
  { studentId: 's1', displayLabel: 'Est 1', estado: 'activo' },
  { studentId: 's2', displayLabel: 'Est 2', estado: 'activo' },
  { studentId: 's3', displayLabel: 'Est 3', estado: 'activo' },
];

function report(progress: WorldProgress[]) {
  return buildCourseReport({
    colegioId: 'A',
    cursoId: 'c1',
    cursoNombre: '9A',
    now: 1,
    roster,
    progress,
  });
}

describe('buildWeaknessReport', () => {
  it('flags competencies whose course average is below the threshold, weakest first', () => {
    const w = buildWeaknessReport(
      report([
        prog('s1', 'ahorro', 0.9),
        prog('s2', 'ahorro', 0.5),
        prog('s3', 'ahorro', 0.4),
        prog('s1', 'presupuesto', 0.9),
        prog('s2', 'presupuesto', 0.9),
        prog('s3', 'presupuesto', 0.9),
      ])
    );
    expect(w.weakCompetencias.map((c) => c.competenciaId)).toEqual(['ahorro']);
    const ahorro = w.weakCompetencias[0];
    expect(ahorro.studentsBelow).toBe(2); // s2 (0.5), s3 (0.4)
    expect(ahorro.studentsWithData).toBe(3);
    expect(Math.round(ahorro.averageMastery * 100)).toBe(60);
  });

  it('lists at-risk students (overall below threshold) weakest first, with their weak areas', () => {
    const w = buildWeaknessReport(
      report([
        prog('s1', 'ahorro', 0.9),
        prog('s1', 'presupuesto', 0.9),
        prog('s2', 'ahorro', 0.5),
        prog('s2', 'presupuesto', 0.9),
        prog('s3', 'ahorro', 0.4),
        prog('s3', 'presupuesto', 0.9),
      ])
    );
    expect(w.studentsAtRisk.map((s) => s.studentId)).toEqual(['s3', 's2']); // 0.65 then 0.70
    expect(w.studentsAtRisk[0].weakAreas.map((a) => a.competenciaId)).toEqual(['ahorro']);
    expect(w.studentsAtRisk.find((s) => s.studentId === 's1')).toBeUndefined();
  });

  it('reports no data when nobody has progress', () => {
    const w = buildWeaknessReport(report([]));
    expect(w.hasData).toBe(false);
    expect(w.weakCompetencias).toEqual([]);
    expect(w.studentsAtRisk).toEqual([]);
  });

  it('returns no weaknesses when the whole course is at/above threshold', () => {
    const w = buildWeaknessReport(
      report([prog('s1', 'ahorro', 0.9), prog('s2', 'ahorro', 0.85), prog('s3', 'ahorro', 0.8)])
    );
    expect(w.hasData).toBe(true);
    expect(w.weakCompetencias).toEqual([]);
    expect(w.studentsAtRisk).toEqual([]);
  });

  it('honours a custom threshold', () => {
    const r = report([prog('s1', 'ahorro', 0.7)]);
    expect(buildWeaknessReport(r, 0.6).weakCompetencias).toEqual([]); // 0.7 >= 0.6
    expect(buildWeaknessReport(r, 0.9).weakCompetencias.map((c) => c.competenciaId)).toEqual([
      'ahorro',
    ]); // 0.7 < 0.9
  });
});
