import {
  construirFicha,
  inicioDeSemana,
  respuestaEnTexto,
  type EntradaFicha,
} from './fichaEstudiante';
import type { IntentoGuardado } from './registroClaseRepository';

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date(2026, 9, 30, 12).getTime(); // jueves

function intento(
  over: Partial<IntentoGuardado> & Pick<IntentoGuardado, 'respuestas'>
): IntentoGuardado {
  return {
    id: Math.random().toString(36),
    uid: 'ana',
    worldId: 'world_1',
    tipo: 'leccion',
    nivel: 0,
    resultado: 'completado',
    inicioAt: AHORA - 1000,
    finAt: AHORA - 1000,
    duracionMs: 5 * 60000,
    total: over.respuestas.length,
    aciertos: over.respuestas.filter((r) => r.ok).length,
    ...over,
  };
}
const r = (p: string, ok: boolean, resp = '0') => ({
  p,
  t: 'multiple_choice',
  ok,
  r: resp,
  ms: 1000,
});

function entrada(over: Partial<EntradaFicha> = {}): EntradaFicha {
  return {
    ahora: AHORA,
    intentos: [],
    visitas: [],
    progreso: [],
    orbita: null,
    mundos: [
      { id: 'world_1', nombre: 'Planeta Origen', competencia: 'dinero' },
      { id: 'cw_tienda', nombre: 'La tienda', competencia: 'personalizada' },
    ],
    textos: new Map(),
    aciertoClase: 0.7,
    ...over,
  };
}

describe('construirFicha', () => {
  it('sin datos: todo vacío pero con los mundos de la clase', () => {
    const f = construirFicha(entrada());
    expect(f).toMatchObject({ nota: null, acierto: null, respuestas: 0, ultimaActividad: null });
    expect(f.mundos.map((m) => m.estado)).toEqual(['sin_empezar', 'sin_empezar']);
    expect(f.semanas).toHaveLength(8);
  });

  it('suma aciertos, tiempo, días activos, visitas y la nota del periodo', () => {
    const f = construirFicha(
      entrada({
        intentos: [
          intento({ respuestas: [r('q1', true), r('q2', false, '2'), r('q2', true)] }),
          intento({
            worldId: 'world_1',
            tipo: 'jefe',
            finAt: AHORA - 2 * DIA,
            respuestas: [r('q1', true), r('q3', true)],
          }),
          intento({ finAt: AHORA - 20 * DIA, respuestas: [r('q2', false, '1')] }),
        ],
        visitas: [
          { dia: 'x', visitas: 3, ultimaAt: AHORA - 3 * DIA },
          { dia: 'y', visitas: 2, ultimaAt: AHORA - 30 * DIA },
        ],
        progreso: [{ worldId: 'world_1', mastery: 0.75, completed: true, competencia: 'dinero' }],
        textos: new Map([
          [
            'q2',
            {
              enunciado: '¿Qué es ahorrar?',
              tipo: 'multiple_choice',
              opciones: ['A', 'Gastar', 'Guardar'],
            },
          ],
        ]),
      })
    );
    expect(f.respuestas).toBe(6);
    expect(f.acierto).toBeCloseTo(4 / 6);
    expect(f.minutosTotal).toBe(15);
    expect(f.minutosSemana).toBe(10);
    expect(f.diasActivosSemana).toBe(3);
    expect(f.visitasSemana).toBe(3);
    expect(f.visitasTotal).toBe(5);
    expect(f.nota).toBe(4); // 1 + 4 × 0.75
    expect(f.desempeno).toBe('alto');
    expect(f.ultimaActividad).toBe(AHORA - 1000);
    expect(f.preguntasQueFalla[0]).toMatchObject({
      id: 'q2',
      enunciado: '¿Qué es ahorrar?',
      vistas: 3,
      aciertos: 1,
      ultimaErrada: 'Guardar',
    });
    expect(f.mundos[0]).toMatchObject({
      estado: 'conquistado',
      lecciones: 2,
      jefesIntentados: 1,
      jefesGanados: 1,
      conquistadoAt: AHORA - 2 * DIA,
      maestria: 0.75,
    });
    expect(f.comparacion).toEqual({ estudiante: 4 / 6, clase: 0.7 });
  });

  it('fuertes y débiles solo con al menos 5 respuestas por competencia', () => {
    const muchas = (ok: boolean) => Array.from({ length: 5 }, (_, k) => r(`p${k}${ok}`, ok));
    const f = construirFicha(
      entrada({
        intentos: [
          intento({ respuestas: muchas(true) }),
          intento({ worldId: 'cw_tienda', respuestas: muchas(false) }),
        ],
      })
    );
    expect(f.fuertes).toEqual(['dinero']);
    expect(f.debiles).toEqual(['personalizada']);
    expect(
      construirFicha(entrada({ intentos: [intento({ respuestas: [r('a', false)] })] })).debiles
    ).toEqual([]);
  });

  it('el historial va por semanas de lunes a domingo', () => {
    const lunes = inicioDeSemana(AHORA);
    expect(new Date(lunes).getDay()).toBe(1);
    const f = construirFicha(
      entrada({ intentos: [intento({ finAt: lunes - 1, respuestas: [r('q', true)] })] })
    );
    expect(f.semanas[7].respuestas).toBe(0);
    expect(f.semanas[6]).toMatchObject({ respuestas: 1, acierto: 1, minutos: 5 });
  });
});

describe('respuestaEnTexto', () => {
  it('traduce índices, verdadero/falso y órdenes', () => {
    expect(
      respuestaEnTexto('1', { enunciado: '', tipo: 'multiple_choice', opciones: ['a', 'b'] })
    ).toBe('b');
    expect(respuestaEnTexto('false', { enunciado: '', tipo: 'true_false' })).toBe('Falso');
    expect(respuestaEnTexto('1-0', { enunciado: '', tipo: 'ordenar', elementos: ['x', 'y'] })).toBe(
      'y → x'
    );
    expect(respuestaEnTexto('7', undefined)).toBe('7');
  });
});
