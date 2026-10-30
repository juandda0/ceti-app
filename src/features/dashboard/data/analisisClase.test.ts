import {
  construirAnalisis,
  materialDeRepaso,
  type EntradaAnalisis,
  type EstudianteDeLaClase,
} from './analisisClase';
import type { IntentoGuardado } from './registroClaseRepository';
import type { AsignacionWithId } from './asignacionRepository';

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date(2026, 9, 30, 12).getTime();

const r = (p: string, ok: boolean, resp = '0') => ({
  p,
  t: 'multiple_choice',
  ok,
  r: resp,
  ms: 1000,
});
function intento(
  uid: string,
  respuestas: ReturnType<typeof r>[],
  over: Partial<IntentoGuardado> = {}
): IntentoGuardado {
  return {
    id: Math.random().toString(36),
    uid,
    worldId: 'world_1',
    tipo: 'leccion',
    nivel: 0,
    resultado: 'completado',
    inicioAt: AHORA - DIA,
    finAt: AHORA - DIA,
    duracionMs: 60000,
    total: respuestas.length,
    aciertos: respuestas.filter((x) => x.ok).length,
    respuestas,
    ...over,
  };
}
const est = (uid: string, over: Partial<EstudianteDeLaClase> = {}): EstudianteDeLaClase => ({
  uid,
  nombre: uid.toUpperCase(),
  intentos: [],
  visitas: [],
  progreso: [],
  ...over,
});
function entrada(
  estudiantes: EstudianteDeLaClase[],
  over: Partial<EntradaAnalisis> = {}
): EntradaAnalisis {
  return {
    ahora: AHORA,
    desde: 0,
    hasta: AHORA,
    estudiantes,
    mundos: [
      { id: 'world_1', nombre: 'Planeta Origen', competencia: 'dinero' },
      { id: 'world_2', nombre: 'Luna', competencia: 'presupuesto' },
    ],
    textos: new Map([
      ['q9', { enunciado: '¿Qué es un CDT?', tipo: 'multiple_choice', opciones: ['A', 'B', 'C'] }],
    ]),
    tareas: [],
    ...over,
  };
}

describe('construirAnalisis', () => {
  it('mapa de calor: estado y aciertos por mundo, nota y última actividad', () => {
    const a = construirAnalisis(
      entrada([
        est('ana', {
          intentos: [intento('ana', [r('q1', true), r('q2', false)])],
          progreso: [
            { worldId: 'world_1', mastery: 0.5, completed: true, completedAt: AHORA - 2 * DIA },
          ],
        }),
        est('leo'),
      ])
    );
    expect(a.mapa[0]).toMatchObject({
      nota: 3,
      acierto: 0.5,
      respuestas: 2,
      ultimaActividad: AHORA - DIA,
    });
    expect(a.mapa[0].celdas.world_1).toEqual({ estado: 'conquistado', acierto: 0.5 });
    expect(a.mapa[0].celdas.world_2).toEqual({ estado: 'sin_empezar', acierto: null });
    expect(a.mapa[1].celdas.world_1.estado).toBe('sin_empezar');
  });

  it('el periodo filtra aciertos pero no la conquista', () => {
    const a = construirAnalisis(
      entrada(
        [
          est('ana', {
            intentos: [intento('ana', [r('q1', true)], { finAt: AHORA - 60 * DIA, tipo: 'jefe' })],
          }),
        ],
        {
          desde: AHORA - 30 * DIA,
        }
      )
    );
    expect(a.mapa[0].celdas.world_1).toEqual({ estado: 'conquistado', acierto: null });
    expect(a.preguntas).toHaveLength(0);
  });

  it('preguntas: facilidad, respuesta errada más elegida y discriminación', () => {
    // 8 estudiantes: los 4 que van bien aciertan q9; los 4 que van mal la fallan con "2".
    const buenos = ['a', 'b', 'c', 'd'].map((u) =>
      est(u, {
        intentos: [
          intento(u, [r('q9', true), r('x1', true), r('x2', true), r('x3', true), r('x4', true)]),
        ],
      })
    );
    const malos = ['e', 'f', 'g', 'h'].map((u) =>
      est(u, {
        intentos: [
          intento(u, [
            r('q9', false, '2'),
            r('x1', false),
            r('x2', false),
            r('x3', true),
            r('x4', false),
          ]),
        ],
      })
    );
    const a = construirAnalisis(entrada([...buenos, ...malos]));
    const q9 = a.preguntas.find((p) => p.id === 'q9')!;
    expect(q9).toMatchObject({
      enunciado: '¿Qué es un CDT?',
      facilidad: 0.5,
      estudiantes: 8,
      discriminacion: 1,
      erradaMasElegida: { texto: 'C', veces: 4 },
      dificil: false,
      revisar: false,
    });
    // x3 la aciertan todos: no discrimina → revisar.
    expect(a.preguntas.find((p) => p.id === 'x3')).toMatchObject({
      discriminacion: 0,
      revisar: true,
    });
    // Las más difíciles primero.
    expect(a.preguntas[0].facilidad).toBeLessThanOrEqual(
      a.preguntas[a.preguntas.length - 1].facilidad
    );
  });

  it('actividad semanal y quién lleva 7 días sin entrar', () => {
    const a = construirAnalisis(
      entrada([
        est('ana', { intentos: [intento('ana', [r('q', true)])] }),
        est('leo', { visitas: [{ dia: 'x', visitas: 1, ultimaAt: AHORA - 10 * DIA }] }),
        est('sol'),
      ])
    );
    expect(a.semanas).toHaveLength(8);
    expect(a.activosSemana).toBe(1);
    expect(a.sinEntrar7.map((s) => s.uid)).toEqual(['sol', 'leo']);
    expect(a.grupos.sinEntrar7).toEqual(['sol', 'leo']);
    // El avance de antes del registro también cuenta como actividad.
    const b = construirAnalisis(
      entrada([
        est('mia', {
          progreso: [{ worldId: 'world_1', mastery: 1, completed: true, updatedAt: AHORA - DIA }],
        }),
      ])
    );
    expect(b.sinEntrar7).toHaveLength(0);
  });

  it('embudo de tareas: a tiempo, tarde y sin hacer; y el grupo bajo 3,0', () => {
    const tarea: AsignacionWithId = {
      id: 't1',
      worldId: 'world_1',
      target: { tipo: 'curso', cursoId: 'k' },
      fechaInicio: AHORA - 10 * DIA,
      deadline: AHORA - 3 * DIA,
      createdByUid: 'p',
      createdAt: 0,
    };
    const a = construirAnalisis(
      entrada(
        [
          est('ana', {
            progreso: [
              { worldId: 'world_1', mastery: 0.9, completed: true, completedAt: AHORA - 5 * DIA },
            ],
          }),
          est('leo', {
            intentos: [intento('leo', [r('q', true)], { tipo: 'jefe', finAt: AHORA - DIA })],
          }),
          est('sol', { progreso: [{ worldId: 'world_2', mastery: 0.2, completed: true }] }),
        ],
        { tareas: [tarea] }
      )
    );
    expect(a.tareas[0]).toMatchObject({
      vencida: true,
      aTiempo: [{ uid: 'ana', nombre: 'ANA' }],
      tarde: [{ uid: 'leo', nombre: 'LEO' }],
      sinHacer: [{ uid: 'sol', nombre: 'SOL' }],
    });
    expect(a.grupos.bajoTres).toEqual(['sol']);
  });
});

describe('materialDeRepaso', () => {
  const q = (id: string, facilidad: number, respuestas = 4) => ({
    id,
    worldId: 'world_2',
    mundo: 'Luna del Presupuesto',
    enunciado: `Pregunta ${id}`,
    respuestas,
    estudiantes: 4,
    facilidad,
    discriminacion: null,
    erradaMasElegida: { texto: 'Gastar todo', veces: 2 },
    dificil: facilidad <= 0.35,
    revisar: false,
  });

  it('toma las más difíciles, sin nombres de estudiantes', () => {
    const m = materialDeRepaso([q('a', 0.9), q('b', 0.2), q('c', 0.5), q('d', 0.1, 1)]);
    expect(m?.nombre).toBe('Repaso: Luna del Presupuesto');
    expect(m?.fuente).toContain('1. Pregunta b');
    expect(m?.fuente).toContain('2. Pregunta c');
    expect(m?.fuente).not.toContain('Pregunta a');
    expect(m?.fuente).not.toContain('Pregunta d'); // una sola respuesta no alcanza
    expect(m?.fuente).toContain('Respuesta errada más elegida: Gastar todo');
  });

  it('sin preguntas difíciles no hay repaso', () => {
    expect(materialDeRepaso([q('a', 0.95)])).toBeNull();
  });
});
