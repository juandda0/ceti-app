const mockDb: { actual: unknown } = { actual: null };

jest.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: (_options: unknown, handler: unknown) => handler,
}));
jest.mock('firebase-admin/firestore', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { incremento } = require('./firestoreFalso.test');
  return {
    getFirestore: () => mockDb.actual,
    FieldValue: { increment: incremento, serverTimestamp: () => 'ts' },
  };
});

// eslint-disable-next-line import/first
import { DIA_MS } from './dominio';
// eslint-disable-next-line import/first
import {
  agregadoAdopcion,
  correrAdopcionDiaria,
  cursoAdopcionDesdeDatos,
  msDe,
  recalcularAdopcionColegio,
  recalcularAdopcionSiToca,
  rutaAgregadoAdopcion,
  tocaRecalcular,
  RECALCULO_MIN_MS,
} from './adopcionColegio';
// eslint-disable-next-line import/first
import { FirestoreFalso } from './firestoreFalso.test';

const AHORA = Date.parse('2026-10-22T12:00:00.000-05:00');

describe('cursoAdopcionDesdeDatos', () => {
  it('cuenta la lista sin suprimidos y los activos de 30 días', () => {
    const c = cursoAdopcionDesdeDatos(
      {
        profesorUids: ['p1', 7, 'p2'],
        roster: [
          { uid: 'ana', estado: 'activo' },
          { uid: 'luis', estado: 'pendiente_atestacion' },
          { uid: 'eva', estado: 'suprimido' },
          { uid: 'sol', estado: 'activo' },
        ],
        progreso: [
          { uid: 'ana', updatedAt: AHORA - DIA_MS },
          { uid: 'ana', updatedAt: AHORA - 40 * DIA_MS },
          { uid: 'sol', updatedAt: { toMillis: () => AHORA - 31 * DIA_MS } },
          { uid: 'eva', updatedAt: AHORA },
          { uid: 'ajeno', updatedAt: AHORA },
          { uid: 'luis', updatedAt: AHORA + DIA_MS },
          { uid: 'luis' },
        ],
      },
      AHORA
    );
    expect(c).toEqual({
      profesorUids: ['p1', 'p2'],
      estudiantes: 3,
      estudiantesActivos: 1,
      ultimaActividad: AHORA - DIA_MS,
    });
  });

  it('un curso sin progreso no tiene actividad', () => {
    expect(
      cursoAdopcionDesdeDatos({ profesorUids: undefined, roster: [{ uid: 'a' }], progreso: [] }, AHORA)
    ).toEqual({ profesorUids: [], estudiantes: 1, estudiantesActivos: 0, ultimaActividad: null });
  });
});

describe('utilidades', () => {
  it('msDe lee números y Timestamps', () => {
    expect(msDe(5)).toBe(5);
    expect(msDe({ seconds: 2 })).toBe(2000);
    expect(msDe({ toMillis: () => 9 })).toBe(9);
    expect(msDe('x')).toBeNull();
  });

  it('tocaRecalcular respeta el mínimo', () => {
    expect(tocaRecalcular(undefined, AHORA)).toBe(true);
    expect(tocaRecalcular(AHORA - RECALCULO_MIN_MS + 1, AHORA)).toBe(false);
    expect(tocaRecalcular(AHORA - RECALCULO_MIN_MS, AHORA)).toBe(true);
  });

  it('agregadoAdopcion no deja pasar campos extra', () => {
    const a = agregadoAdopcion({
      profes: 1,
      profesActivos: 1,
      cursos: 1,
      estudiantes: 2,
      estudiantesActivos: 1,
      adopcion: 0.5,
      cumpleMeta: false,
      senalNave: false,
      uids: ['ana'],
    } as never);
    expect(Object.keys(a).sort()).toEqual(
      [
        'adopcion',
        'cumpleMeta',
        'cursos',
        'estudiantes',
        'estudiantesActivos',
        'profes',
        'profesActivos',
        'senalNave',
      ].sort()
    );
  });
});

function colegioDemo(): FirestoreFalso {
  const progreso = (cid: string, cursoId: string, uid: string, worldId: string, dias: number) => ({
    [`colegios/${cid}/cursos/${cursoId}/estudiantes/${uid}/progress/${worldId}`]: {
      colegioId: cid,
      cursoId,
      uid,
      mastery: 0.5,
      updatedAt: AHORA - dias * DIA_MS,
    },
  });
  return new FirestoreFalso({
    'colegios/col1': { nombre: 'Colegio' },
    'colegios/col1/cursos/9a': { nombre: '9A', profesorUids: ['p1'] },
    'colegios/col1/cursos/9b': { nombre: '9B', profesorUids: ['p2', 'p3'] },
    'colegios/col1/cursos/10a': { nombre: '10A', profesorUids: ['p4'] },
    'colegios/col1/cursos/9a/estudiantes/ana': { nombre: 'Ana', estado: 'activo' },
    'colegios/col1/cursos/9a/estudiantes/luis': { nombre: 'Luis', estado: 'activo' },
    'colegios/col1/cursos/9b/estudiantes/sol': { nombre: 'Sol', estado: 'activo' },
    'colegios/col1/cursos/10a/estudiantes/leo': { nombre: 'Leo', estado: 'activo' },
    ...progreso('col1', '9a', 'ana', 'world_1', 2),
    ...progreso('col1', '9a', 'ana', 'world_2', 1),
    ...progreso('col1', '9b', 'sol', 'world_1', 3),
    ...progreso('col1', '10a', 'leo', 'world_1', 60),
    // Otro colegio: no se mezcla.
    'colegios/col2': { nombre: 'Otro' },
    'colegios/col2/cursos/x': { nombre: 'X', profesorUids: ['q1'] },
    'colegios/col2/cursos/x/estudiantes/zoe': { nombre: 'Zoe', estado: 'activo' },
    ...progreso('col2', 'x', 'zoe', 'world_1', 1),
  });
}

describe('recalcularAdopcionColegio', () => {
  it('guarda solo cifras del colegio entero', async () => {
    const db = colegioDemo();
    const a = await recalcularAdopcionColegio('col1', AHORA, db as never);
    expect(a).toEqual({
      profes: 4,
      profesActivos: 3,
      cursos: 3,
      estudiantes: 4,
      estudiantesActivos: 2,
      adopcion: 0.5,
      cumpleMeta: false,
      senalNave: true,
    });
    const doc = db.datos(rutaAgregadoAdopcion('col1'));
    expect(doc).toEqual({ ...a, actualizadoAt: 'ts' });
    // Nada nominal: ningún uid, nombre ni correo.
    const texto = JSON.stringify(doc);
    for (const nominal of ['ana', 'Ana', 'p1', 'sol', '@']) expect(texto).not.toContain(nominal);
  });
});

describe('recalcularAdopcionSiToca', () => {
  it('no recalcula dentro del mínimo y sí después', async () => {
    const db = colegioDemo();
    await db.doc(rutaAgregadoAdopcion('col1')).set({ cursos: 0, actualizadoAt: AHORA - 60_000 });
    expect(await recalcularAdopcionSiToca('col1', AHORA, db as never)).toBe(false);
    expect(db.datos(rutaAgregadoAdopcion('col1'))?.cursos).toBe(0);

    await db
      .doc(rutaAgregadoAdopcion('col1'))
      .set({ cursos: 0, actualizadoAt: { toMillis: () => AHORA - RECALCULO_MIN_MS } });
    expect(await recalcularAdopcionSiToca('col1', AHORA, db as never)).toBe(true);
    expect(db.datos(rutaAgregadoAdopcion('col1'))?.cursos).toBe(3);
  });

  it('recalcula si aún no existe', async () => {
    const db = colegioDemo();
    expect(await recalcularAdopcionSiToca('col2', AHORA, db as never)).toBe(true);
    expect(db.datos(rutaAgregadoAdopcion('col2'))?.estudiantesActivos).toBe(1);
  });
});

describe('correrAdopcionDiaria', () => {
  it('recalcula todos los colegios', async () => {
    const db = colegioDemo();
    mockDb.actual = db;
    const r = await correrAdopcionDiaria(AHORA);
    expect(r).toEqual({ colegios: 2, recalculados: 2, errores: 0, pendientes: 0 });
    expect(db.datos(rutaAgregadoAdopcion('col1'))?.profes).toBe(4);
    expect(db.datos(rutaAgregadoAdopcion('col2'))?.profes).toBe(1);
  });
});
