import {
  calcularAdopcion,
  construirBitacora,
  DIA_MS,
  periodosCalendarioA,
} from '@/functions/src/educadores/dominio';
import type { StudentReportRow } from '@features/dashboard/data/courseReport';
import type { AsignacionAny } from '@shared/types/tenancy';
import {
  asignacionesActivas,
  cursoBitacoraDesdeReporte,
  mundoMasDificil,
  quicesUltimos7Dias,
  type ProgresoMundo,
} from './bitacoraCursos';
import { entradasNotaDesdeReporte, rangoPeriodo } from './notasEntradas';
import { cursosAdopcionDesdeColegio, msDeMarca } from './adopcionCursos';

const AHORA = Date.parse('2026-10-22T15:00:00.000Z');

function progreso(
  uid: string,
  worldId: string,
  competencia: string,
  mastery: number,
  updatedAt: number,
  extra: Partial<ProgresoMundo> = {}
): ProgresoMundo {
  return {
    colegioId: 'col',
    cursoId: 'c1',
    uid,
    worldId,
    competencia,
    mastery,
    quizScores: {},
    completed: false,
    updatedAt,
    ...extra,
  };
}

function fila(
  uid: string,
  nombre: string,
  lastActivity: number | null,
  estado: StudentReportRow['estado'] = 'activo',
  overallMastery = 0.5
): StudentReportRow {
  return { uid, nombre, estado, masteryByCompetencia: {}, overallMastery, lastActivity };
}

const nombres: Record<string, string> = {
  world_1: 'Planeta Origen',
  world_2: 'Luna del Presupuesto',
};
const nombreMundo = (id: string) => nombres[id] ?? id;

describe('Bitácora desde el tablero', () => {
  it('cuenta como quiz cada progreso tocado en los últimos 7 días', () => {
    const p = [
      progreso('a', 'world_1', 'ingreso', 0.8, AHORA - 1 * DIA_MS),
      progreso('a', 'world_2', 'presupuesto', 0.8, AHORA - 6.9 * DIA_MS),
      progreso('b', 'world_1', 'ingreso', 0.8, AHORA - 8 * DIA_MS),
      progreso('c', 'world_1', 'ingreso', 0.8, AHORA + DIA_MS), // reloj adelantado: fuera
    ];
    expect(quicesUltimos7Dias(p, AHORA)).toBe(2);
  });

  it('el mundo más difícil es el de menor maestría promedio, con su nombre', () => {
    const p = [
      progreso('a', 'world_1', 'ingreso', 0.9, AHORA),
      progreso('b', 'world_1', 'ingreso', 0.7, AHORA),
      progreso('a', 'world_2', 'presupuesto', 0.4, AHORA),
      progreso('b', 'world_2', 'presupuesto', 0.6, AHORA),
    ];
    expect(mundoMasDificil(p, nombreMundo)).toEqual({
      worldId: 'world_2',
      nombre: 'Luna del Presupuesto',
      maestria: 0.5,
    });
    expect(mundoMasDificil([], nombreMundo)).toBeNull();
  });

  it('solo cuenta asignaciones vigentes', () => {
    const base = {
      target: { tipo: 'curso' as const, cursoId: 'c1' },
      createdByUid: 'p',
      createdAt: 0,
    };
    const a: AsignacionAny[] = [
      { ...base, worldId: 'world_1', fechaInicio: AHORA - DIA_MS, deadline: AHORA + DIA_MS },
      { ...base, worldId: 'world_2', fechaInicio: AHORA - 9 * DIA_MS, deadline: AHORA - DIA_MS },
      { ...base, worldId: 'world_3', fechaInicio: AHORA + DIA_MS, deadline: AHORA + 9 * DIA_MS },
    ];
    expect(asignacionesActivas(a, AHORA)).toBe(1);
  });

  it('arma el CursoBitacora sin suprimidos ni su progreso, y la bitácora lo entiende', () => {
    const estudiantes = [
      fila('a', 'Ana', AHORA - DIA_MS, 'activo', 0.8),
      fila('b', 'Beto', null, 'activo', 0),
      fila('c', 'Caro', AHORA - 20 * DIA_MS, 'pendiente_atestacion'),
      fila('d', 'Dani', AHORA - DIA_MS, 'suprimido'),
    ];
    const curso = cursoBitacoraDesdeReporte({
      cursoId: 'c1',
      nombre: '10°B',
      estudiantes,
      progreso: [
        progreso('a', 'world_1', 'ingreso', 0.8, AHORA - DIA_MS),
        progreso('d', 'world_2', 'presupuesto', 0.1, AHORA - DIA_MS),
      ],
      asignaciones: [],
      nombreMundo,
      ahora: AHORA,
    });
    expect(curso.estudiantes.map((e) => e.nombre)).toEqual(['Ana', 'Beto', 'Caro']);
    expect(curso.estudiantes.map((e) => e.activo)).toEqual([true, true, false]);
    expect(curso.quicesSemana).toBe(1);
    expect(curso.mundoMasDificil).toEqual({ nombre: 'Planeta Origen', maestria: 0.8 });
    expect(curso.asignacionesActivas).toBe(0);

    const b = construirBitacora([curso], '2026-W43', AHORA);
    expect(b.estudiantes).toBe(2);
    expect(b.activosSemana).toBe(1);
    expect(b.alertas.map((x) => x.nombre)).toEqual(['Beto']);
  });
});

describe('Notas desde el reporte', () => {
  const [p1, , , p4] = periodosCalendarioA(2026);
  const enP4 = Date.parse('2026-10-01T15:00:00.000Z');
  const enP1 = Date.parse('2026-03-01T15:00:00.000Z');

  it('el rango del periodo cubre del primer al último día completos en Bogotá', () => {
    const r = rangoPeriodo(p4);
    expect(r.desde).toBe(Date.parse('2026-09-16T05:00:00.000Z'));
    expect(r.hasta).toBe(Date.parse('2026-12-01T05:00:00.000Z') - 1);
  });

  it('usa solo el progreso del periodo, ignora competencias propias y ordena por nombre', () => {
    const estudiantes = [
      fila('z', 'Zoe', enP4),
      fila('a', 'Álvaro', enP4),
      fila('s', 'Sup', enP4, 'suprimido'),
      fila('n', 'Nadie', null),
    ];
    const p = [
      progreso('z', 'world_1', 'ingreso', 0.6, enP4),
      progreso('z', 'world_2', 'presupuesto', 1, enP4, { completed: true, completedAt: enP4 }),
      progreso('z', 'world_3', 'ahorro', 0.2, enP1), // otro periodo
      progreso('z', 'cw_x', 'personalizada', 1, enP4, { completed: true, completedAt: enP4 }),
      progreso('a', 'world_1', 'ingreso', 0.9, enP4, { completed: true, completedAt: enP1 }),
      progreso('s', 'world_1', 'ingreso', 0.9, enP4),
    ];
    const e = entradasNotaDesdeReporte(estudiantes, p, p4);
    expect(e.map((x) => x.nombre)).toEqual(['Álvaro', 'Nadie', 'Zoe']);
    expect(e[2]).toEqual({
      nombre: 'Zoe',
      maestriaPorCompetencia: { ingreso: 0.6, presupuesto: 1 },
      mundosCompletados: 2,
    });
    // Completó el mundo en el periodo 1: no cuenta como completado en el 4.
    expect(e[0]).toEqual({
      nombre: 'Álvaro',
      maestriaPorCompetencia: { ingreso: 0.9 },
      mundosCompletados: 0,
    });
    expect(e[1]).toEqual({ nombre: 'Nadie', maestriaPorCompetencia: {}, mundosCompletados: 0 });

    const enPrimero = entradasNotaDesdeReporte(estudiantes, p, p1);
    expect(enPrimero.find((x) => x.nombre === 'Zoe')?.maestriaPorCompetencia).toEqual({
      ahorro: 0.2,
    });
  });
});

describe('Adopción desde el colegio', () => {
  const resumen = (estudiantesActivos: number, actualizadoAt: unknown, extra = {}) => ({
    colegioId: 'col',
    cursoId: 'c',
    porCompetencia: {},
    porMundo: {},
    estudiantesActivos,
    masteryPromedio: 0.5,
    porcentajeCompletado: 0.2,
    actualizadoAt,
    ...extra,
  });

  it('lee la marca de tiempo de Firestore, número o nada', () => {
    expect(msDeMarca(123)).toBe(123);
    expect(msDeMarca({ toMillis: () => 456 })).toBe(456);
    expect(msDeMarca({ seconds: 7 })).toBe(7000);
    expect(msDeMarca(undefined)).toBeNull();
  });

  it('usa la lista propia si la conoce y solo cuenta activos si el curso se movió en 30 días', () => {
    const cursos = cursosAdopcionDesdeColegio(
      [
        {
          id: 'propio',
          profesorUids: ['p1'],
          resumen: resumen(20, AHORA - DIA_MS),
          totalLista: 30,
        },
        {
          id: 'ajeno',
          profesorUids: ['p2'],
          resumen: resumen(10, { seconds: (AHORA - 40 * DIA_MS) / 1000 }),
          totalLista: null,
        },
        { id: 'nuevo', profesorUids: ['p3'], resumen: null, totalLista: 25 },
        {
          id: 'servidor',
          profesorUids: ['p4'],
          resumen: resumen(12, AHORA, { estudiantesTotal: 40, estudiantesActivos30d: 50 }),
          totalLista: 5,
        },
      ],
      AHORA
    );
    expect(cursos).toEqual([
      {
        profesorUids: ['p1'],
        estudiantes: 30,
        estudiantesActivos: 20,
        ultimaActividad: AHORA - DIA_MS,
      },
      {
        profesorUids: ['p2'],
        estudiantes: 10,
        estudiantesActivos: 0,
        ultimaActividad: AHORA - 40 * DIA_MS,
      },
      { profesorUids: ['p3'], estudiantes: 25, estudiantesActivos: 0, ultimaActividad: null },
      // El servidor manda y los activos nunca superan el total.
      { profesorUids: ['p4'], estudiantes: 40, estudiantesActivos: 40, ultimaActividad: AHORA },
    ]);
    const a = calcularAdopcion(cursos, AHORA);
    expect(a.profesActivos).toBe(2);
    expect(a.estudiantes).toBe(105);
  });
});
