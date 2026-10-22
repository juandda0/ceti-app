const mockDb: { actual: unknown } = { actual: null };
const mockGetUsers = jest.fn();

jest.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: (_options: unknown, handler: unknown) => handler,
}));
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({ getUsers: mockGetUsers }) }));
jest.mock('firebase-admin/firestore', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { incremento } = require('./firestoreFalso.test');
  return {
    getFirestore: () => mockDb.actual,
    FieldValue: { increment: incremento, serverTimestamp: () => 'ts' },
    FieldPath: { documentId: () => '__name__' },
  };
});

// eslint-disable-next-line import/first
import { DIA_MS, semanaIso } from './dominio';
// eslint-disable-next-line import/first
import {
  bitacoraDeProfe,
  correrBitacoraSemanal,
  cursoParaBitacora,
  nombreDeMundo,
} from './bitacoraSemanal';
// eslint-disable-next-line import/first
import { FirestoreFalso } from './firestoreFalso.test';

const AHORA = Date.parse('2026-10-25T19:00:00.000-05:00');
const SEMANA = semanaIso(AHORA);

describe('cursoParaBitacora', () => {
  it('arma estudiantes, quices de la semana, mundo difícil y asignaciones', () => {
    const c = cursoParaBitacora(
      {
        cursoId: 'c1',
        nombre: '9A',
        roster: [
          { uid: 'ana', nombre: 'Ana', estado: 'activo' },
          { uid: 'luis', nombre: 'Luis', estado: 'pendiente_atestacion' },
          { uid: 'eva', nombre: 'Eva', estado: 'suprimido' },
        ],
        progreso: [
          { uid: 'ana', mastery: 0.8, updatedAt: AHORA - DIA_MS },
          { uid: 'ana', mastery: 0.4, updatedAt: AHORA - 10 * DIA_MS },
          { uid: 'eva', mastery: 1, updatedAt: AHORA - DIA_MS },
          { uid: 'ajeno', mastery: 1, updatedAt: AHORA - DIA_MS },
        ],
        porMundo: {
          world_2: { masteryPromedio: 0.7, estudiantes: 3 },
          world_5: { masteryPromedio: 0.4, estudiantes: 2 },
          cw_x: { masteryPromedio: 0.1, estudiantes: 0 },
        },
        mundosConfig: [{ worldId: 'world_5', nombre: '  ' }],
        asignaciones: [
          { fechaInicio: AHORA - DIA_MS, deadline: AHORA + DIA_MS },
          { fechaInicio: AHORA - 9 * DIA_MS, deadline: AHORA - DIA_MS },
          { fechaInicio: AHORA + DIA_MS, deadline: AHORA + 2 * DIA_MS },
        ],
      },
      AHORA
    );
    expect(c.estudiantes).toEqual([
      {
        nombre: 'Ana',
        activo: true,
        ultimaActividad: AHORA - DIA_MS,
        maestria: expect.closeTo(0.6),
      },
      { nombre: 'Luis', activo: false, ultimaActividad: null, maestria: 0 },
    ]);
    expect(c.quicesSemana).toBe(1);
    expect(c.mundoMasDificil).toEqual({ nombre: 'Agujero Negro de las Deudas', maestria: 0.4 });
    expect(c.asignacionesActivas).toBe(1);
  });

  it('usa el nombre propio del mundo o su id', () => {
    expect(nombreDeMundo('cw_1', [{ worldId: 'cw_1', nombre: 'Mi mundo' }])).toBe('Mi mundo');
    expect(nombreDeMundo('cw_2', null)).toBe('cw_2');
    expect(nombreDeMundo('world_1')).toBe('Planeta Origen');
  });
});

function sembrar() {
  const db = new FirestoreFalso({
    'membership/p1': { role: 'profesor', colegioId: 'col' },
    'membership/p2': { role: 'profesor', colegioId: 'col' },
    'membership/e1': { role: 'estudiante', colegioId: 'col', cursoId: 'c1' },
    'membership/p3': { role: 'profesor' },
    'suscripciones/p2': { correoBitacora: false },
    'colegios/col/cursos/c1': { nombre: '9A', profesorUids: ['p1'] },
    'colegios/col/cursos/c1/estudiantes/e1': { nombre: 'Ana', estado: 'activo' },
    'colegios/col/cursos/c1/estudiantes/e1/progress/world_1': {
      colegioId: 'col',
      cursoId: 'c1',
      uid: 'e1',
      mastery: 0.9,
      updatedAt: AHORA - DIA_MS,
    },
    'colegios/col/cursos/c1/agregados/resumen': {
      porMundo: { world_1: { masteryPromedio: 0.9, estudiantes: 1 } },
    },
  });
  mockDb.actual = db;
  return db;
}

describe('bitacoraDeProfe', () => {
  it('guarda la Bitácora, encola el correo y crea la prueba si faltaba', async () => {
    const db = sembrar();
    const d = db as unknown as FirebaseFirestore.Firestore;
    const r = await bitacoraDeProfe(
      d,
      { uid: 'p1', colegioId: 'col', email: 'p1@x.co', nombre: 'Profe' },
      AHORA
    );
    expect(r).toBe('escrita');
    expect(db.datos(`bitacoras/p1/semanas/${SEMANA}`)).toMatchObject({
      semana: SEMANA,
      cursos: 1,
      estudiantes: 1,
      activosSemana: 1,
      quicesSemana: 1,
      correo: 'encolado',
      mundoMasDificil: { cursoNombre: '9A', nombre: 'Planeta Origen', maestria: 0.9 },
    });
    const correos = [...db.docs.entries()].filter(([p]) => p.startsWith('mail/'));
    expect(correos).toHaveLength(1);
    expect(correos[0][1]).toMatchObject({ to: 'p1@x.co' });
    expect(db.datos('suscripciones/p1')).toMatchObject({ estado: 'prueba', planVigente: 'piloto' });

    // Idempotente: la segunda vez no reescribe ni reenvía.
    expect(
      await bitacoraDeProfe(
        d,
        { uid: 'p1', colegioId: 'col', email: 'p1@x.co', nombre: null },
        AHORA
      )
    ).toBe('ya_existia');
    expect([...db.docs.keys()].filter((p) => p.startsWith('mail/'))).toHaveLength(1);
  });

  it('respeta correoBitacora === false', async () => {
    const db = sembrar();
    const d = db as unknown as FirebaseFirestore.Firestore;
    await bitacoraDeProfe(
      d,
      { uid: 'p2', colegioId: 'col', email: 'p2@x.co', nombre: null },
      AHORA
    );
    expect(db.datos(`bitacoras/p2/semanas/${SEMANA}`)).toMatchObject({
      cursos: 0,
      siguientePaso: 'crear_clase',
      correo: 'apagado',
    });
    expect([...db.docs.keys()].filter((p) => p.startsWith('mail/'))).toHaveLength(0);
  });
});

describe('correrBitacoraSemanal', () => {
  it('recorre solo profes y tolera errores por profe', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const db = sembrar();
    mockGetUsers.mockResolvedValue({
      users: [
        { uid: 'p1', email: 'p1@x.co', displayName: 'Profe Uno' },
        { uid: 'p2', email: 'p2@x.co' },
      ],
    });
    // p2 falla al leer sus clases; p1 sigue.
    const original = db.collection.bind(db);
    db.collection = ((ruta: string) => {
      const col = original(ruta);
      if (ruta !== 'colegios/col/cursos') return col;
      const where = col.where.bind(col);
      return Object.assign(col, {
        where: (c: string, op: string, v: unknown) => {
          if (v === 'p2') throw new Error('boom');
          return where(c, op, v);
        },
      });
    }) as typeof db.collection;

    const cuenta = await correrBitacoraSemanal(AHORA, db as unknown as FirebaseFirestore.Firestore);
    expect(cuenta).toEqual({ escritas: 1, yaExistian: 0, omitidas: 1, errores: 1, profes: 3 });
    expect(db.datos(`bitacoras/p1/semanas/${SEMANA}`)).toBeDefined();
    expect(db.datos(`bitacoras/e1/semanas/${SEMANA}`)).toBeUndefined();
  });
});
