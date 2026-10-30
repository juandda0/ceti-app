jest.mock('firebase-functions/v2/firestore', () => ({ onDocumentCreated: jest.fn() }));
jest.mock('firebase-admin/firestore', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { incremento } = require('./firestoreFalso.test');
  return {
    getFirestore: () => {
      throw new Error('usa la base falsa');
    },
    FieldValue: { increment: incremento },
  };
});

// eslint-disable-next-line import/first
import type { Firestore } from 'firebase-admin/firestore';
// eslint-disable-next-line import/first
import {
  RESUMEN_VACIO,
  claveRespuesta,
  leerIntento,
  procesarIntento,
  sumaPreguntas,
  sumarIntento,
} from './registroClase';
// eslint-disable-next-line import/first
import { FirestoreFalso } from './firestoreFalso.test';

const intento = (over: Record<string, unknown> = {}) => ({
  worldId: 'cw_tienda',
  tipo: 'leccion',
  nivel: 0,
  resultado: 'completado',
  inicioAt: 1_000,
  finAt: 61_000,
  duracionMs: 60_000,
  total: 3,
  aciertos: 2,
  respuestas: [
    { p: 'q1', t: 'multiple_choice', ok: true, r: 'Ahorrar', ms: 4_000 },
    { p: 'q2', t: 'multiple_choice', ok: false, r: '  Gastar   todo ', ms: 9_000 },
    { p: 'q2', t: 'multiple_choice', ok: true, r: 'Guardar', ms: 3_000 },
  ],
  ...over,
});

describe('leerIntento', () => {
  it('recorta lo que llega y descarta lo que no sirve', () => {
    const i = leerIntento({ ...intento(), duracionMs: 99_999_999 });
    expect(i?.duracionMs).toBe(2 * 60 * 60 * 1000);
    expect(i?.respuestas).toHaveLength(3);
    expect(leerIntento({ ...intento(), tipo: 'otra' })).toBeNull();
    expect(leerIntento(undefined)).toBeNull();
  });
});

describe('sumarIntento', () => {
  it('suma por desempeño del MEN solo los ids válidos (Fase 7)', () => {
    const i = leerIntento(
      intento({
        respuestas: [
          { p: 'q1', t: 'multiple_choice', ok: true, r: 'a', ms: 1, d: 'PR-45-1' },
          { p: 'q2', t: 'true_false', ok: false, r: 'b', ms: 1, d: 'PR-45-1' },
          { p: 'q3', t: 'ordenar', ok: true, r: '0-1-2', ms: 1, d: '<script>' },
        ],
      })
    )!;
    expect(i.respuestas[2].d).toBeUndefined();
    const r = sumarIntento(sumarIntento({ ...RESUMEN_VACIO, porDesempeno: undefined } as never, i), i);
    expect(r.porDesempeno).toEqual({ 'PR-45-1': { respuestas: 4, aciertos: 2 } });
  });

  it('acumula totales, fechas y el jefe ganado por mundo', () => {
    const a = leerIntento(intento())!;
    const b = leerIntento(
      intento({
        tipo: 'jefe',
        finAt: 200_000,
        respuestas: [{ p: 'q9', t: 'true_false', ok: true, r: 'true', ms: 1 }],
      })
    )!;
    const c = leerIntento(intento({ tipo: 'jefe', resultado: 'perdido', finAt: 100_000 }))!;
    const r = [a, c, b].reduce(sumarIntento, RESUMEN_VACIO);
    expect(r).toMatchObject({
      intentos: 3,
      lecciones: 1,
      jefes: 2,
      jefesGanados: 1,
      respuestas: 7,
      aciertos: 5,
      primerIntentoAt: 61_000,
      ultimoIntentoAt: 200_000,
    });
    expect(r.porMundo.cw_tienda).toMatchObject({ intentos: 3, conquistadoAt: 200_000 });
  });
});

describe('sumaPreguntas', () => {
  it('cuenta vistas, aciertos, tiempo y las respuestas erradas', () => {
    const s = sumaPreguntas(leerIntento(intento())!, (n) => n);
    expect(s.porPregunta.q1).toEqual({ tipo: 'multiple_choice', vistas: 1, aciertos: 1, ms: 4000 });
    expect(s.porPregunta.q2).toEqual({
      tipo: 'multiple_choice',
      vistas: 2,
      aciertos: 1,
      ms: 12000,
      errores: { 'Gastar todo': 1 },
    });
    expect(claveRespuesta('   ')).toBe('(vacía)');
  });
});

describe('procesarIntento', () => {
  it('escribe el resumen del estudiante y suma a las preguntas del mundo', async () => {
    const db = new FirestoreFalso();
    const base = 'colegios/c1/cursos/k1';
    await procesarIntento(db as unknown as Firestore, 'c1', 'k1', 'ana', intento());
    await procesarIntento(
      db as unknown as Firestore,
      'c1',
      'k1',
      'ana',
      intento({ finAt: 90_000 })
    );
    expect(db.docs.get(`${base}/estudiantes/ana/resumen/clase`)).toMatchObject({
      intentos: 2,
      respuestas: 6,
      aciertos: 4,
      ultimoIntentoAt: 90_000,
    });
    const preguntas = db.docs.get(`${base}/agregados/preguntas_cw_tienda`) as {
      porPregunta: Record<string, { vistas: number; errores?: Record<string, number> }>;
    };
    expect(preguntas.porPregunta.q2.vistas).toBe(4);
    expect(preguntas.porPregunta.q2.errores?.['Gastar todo']).toBe(2);
  });
});
