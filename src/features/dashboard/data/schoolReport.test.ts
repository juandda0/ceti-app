import {
  buildSchoolReport,
  buildSchoolReportFromAggregates,
  schoolReportToCsv,
  type CursoMeta,
} from '@features/dashboard/data/schoolReport';
import type { ResumenAgregado } from '@features/dashboard/data/agregadosRepository';
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

  it('CSV has a course table and a competency summary', () => {
    const csv = schoolReportToCsv(buildSchoolReport(input));
    expect(csv).toContain('cursoId');
    expect(csv).toContain('competencia,dominioPromedio');
    expect(csv).toContain('9A');
  });
});

function resumen(
  cursoId: string,
  estudiantesActivos: number,
  masteryPromedio: number,
  porCompetencia: Record<string, { masteryPromedio: number; estudiantes: number }>
): ResumenAgregado {
  return {
    colegioId: 'A',
    cursoId,
    porCompetencia: Object.fromEntries(
      Object.entries(porCompetencia).map(([k, v]) => [k, { ...v, completados: 0 }])
    ),
    porMundo: {},
    estudiantesActivos,
    masteryPromedio,
    porcentajeCompletado: 0,
  };
}

describe('buildSchoolReportFromAggregates (rector path — no nominal data)', () => {
  it('mirrors the collection-group report for the same underlying data', () => {
    // c1: 2 students on ahorro avg 0.7; c2: 1 student on credito 0.2.
    const r = buildSchoolReportFromAggregates({
      colegioId: 'A',
      now: 1000,
      cursos,
      resumenes: [
        {
          cursoId: 'c1',
          resumen: resumen('c1', 2, 0.7, { ahorro: { masteryPromedio: 0.7, estudiantes: 2 } }),
        },
        {
          cursoId: 'c2',
          resumen: resumen('c2', 1, 0.2, { credito: { masteryPromedio: 0.2, estudiantes: 1 } }),
        },
      ],
    });
    const direct = buildSchoolReport(input);
    expect(r.overallMastery).toBeCloseTo(direct.overallMastery);
    expect(r.weakestCompetencia?.competenciaId).toBe('credito');
    const c1 = r.courseSummaries.find((c) => c.cursoId === 'c1')!;
    expect(c1.avgMastery).toBeCloseTo(0.7);
    expect(c1.studentsWithData).toBe(2);
  });

  it('treats a course without an aggregate as having no data (no crash)', () => {
    const r = buildSchoolReportFromAggregates({
      colegioId: 'A',
      now: 1,
      cursos,
      resumenes: [
        {
          cursoId: 'c1',
          resumen: resumen('c1', 1, 0.5, { ahorro: { masteryPromedio: 0.5, estudiantes: 1 } }),
        },
        { cursoId: 'c2', resumen: null },
      ],
    });
    const c2 = r.courseSummaries.find((c) => c.cursoId === 'c2')!;
    expect(c2.avgMastery).toBe(0);
    expect(c2.studentsWithData).toBe(0);
    expect(r.overallMastery).toBeCloseTo(0.5);
  });

  it('weights school-wide competency average by students per course', () => {
    const r = buildSchoolReportFromAggregates({
      colegioId: 'A',
      now: 1,
      cursos,
      resumenes: [
        {
          cursoId: 'c1',
          resumen: resumen('c1', 3, 0.9, { ahorro: { masteryPromedio: 0.9, estudiantes: 3 } }),
        },
        {
          cursoId: 'c2',
          resumen: resumen('c2', 1, 0.1, { ahorro: { masteryPromedio: 0.1, estudiantes: 1 } }),
        },
      ],
    });
    const ahorro = r.competencyAverages.find((c) => c.competenciaId === 'ahorro')!;
    // (0.9*3 + 0.1*1) / 4 = 0.7
    expect(ahorro.averageMastery).toBeCloseTo(0.7);
    expect(ahorro.studentsWithData).toBe(4);
  });
});
