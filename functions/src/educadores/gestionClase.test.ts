jest.mock('firebase-functions/v2/https', () => ({
  onCall: (_options: unknown, handler?: unknown) => handler ?? _options,
  HttpsError: class HttpsError extends Error {
    code: string;
    details: unknown;
    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
    }
  },
}));
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => {
    throw new Error('usa la base falsa');
  },
  FieldValue: { serverTimestamp: () => 'ts' },
}));

// eslint-disable-next-line import/first
import type { Firestore } from 'firebase-admin/firestore';
// eslint-disable-next-line import/first
import {
  borrarClase,
  contarClasesActivas,
  editarClase,
  estadoAlVolver,
  leerCambiosClase,
  retirarDeClase,
  sigueEnClase,
} from './gestionClase';
// eslint-disable-next-line import/first
import { contarRoster } from './limites';
// eslint-disable-next-line import/first
import { FirestoreFalso } from './firestoreFalso.test';

const CURSO = 'colegios/c1/cursos/k1';

function base(): FirestoreFalso {
  return new FirestoreFalso({
    [CURSO]: { nombre: '9A', grado: '9', profesorUids: ['p1'], codigo: 'ABC234' },
    'classCodes/ABC234': { colegioId: 'c1', cursoId: 'k1' },
    [`${CURSO}/estudiantes/ana`]: { nombre: 'Ana', estado: 'activo', atestado: true },
    [`${CURSO}/estudiantes/leo`]: { nombre: 'Leo', estado: 'pendiente_atestacion' },
    [`${CURSO}/estudiantes/sol`]: { nombre: 'Sol', estado: 'suprimido' },
  });
}

const comoDb = (db: FirestoreFalso) => db as unknown as Firestore;

describe('sigueEnClase / estadoAlVolver', () => {
  it('solo activos y pendientes siguen en la clase', () => {
    expect(sigueEnClase('activo')).toBe(true);
    expect(sigueEnClase('pendiente_atestacion')).toBe(true);
    expect(sigueEnClase('retirado')).toBe(false);
    expect(sigueEnClase('suprimido')).toBe(false);
    expect(sigueEnClase(undefined)).toBe(false);
  });

  it('vuelve activo solo si ya estaba autorizado', () => {
    expect(estadoAlVolver(true)).toBe('activo');
    expect(estadoAlVolver(false)).toBe('pendiente_atestacion');
    expect(estadoAlVolver(undefined)).toBe('pendiente_atestacion');
  });
});

describe('retirarDeClase', () => {
  it('marca retirado, conserva el resto y deja de ocupar cupo', async () => {
    const db = base();
    expect(await contarRoster('c1', 'k1', comoDb(db))).toBe(2);
    const ok = await retirarDeClase(
      comoDb(db),
      'c1',
      'k1',
      'ana',
      { quien: 'profesor', uid: 'p1' },
      100
    );
    expect(ok).toBe(true);
    expect(db.docs.get(`${CURSO}/estudiantes/ana`)).toMatchObject({
      nombre: 'Ana',
      atestado: true,
      estado: 'retirado',
      retiradoAt: 100,
      retiradoPor: 'profesor',
      retiradoPorUid: 'p1',
    });
    expect(await contarRoster('c1', 'k1', comoDb(db))).toBe(1);
  });

  it('es idempotente y no toca a los suprimidos ni a quien no está', async () => {
    const db = base();
    const por = { quien: 'estudiante' as const, uid: 'ana' };
    await retirarDeClase(comoDb(db), 'c1', 'k1', 'ana', por);
    expect(await retirarDeClase(comoDb(db), 'c1', 'k1', 'ana', por)).toBe(false);
    expect(await retirarDeClase(comoDb(db), 'c1', 'k1', 'sol', por)).toBe(false);
    expect(db.docs.get(`${CURSO}/estudiantes/sol`)?.estado).toBe('suprimido');
    expect(await retirarDeClase(comoDb(db), 'c1', 'k1', 'nadie', por)).toBe(false);
    expect(db.docs.has(`${CURSO}/estudiantes/nadie`)).toBe(false);
  });
});

describe('leerCambiosClase', () => {
  it('valida nombre, grado y banderas', () => {
    expect(leerCambiosClase({ nombre: '  9B  ', grado: '10', archivada: true })).toEqual({
      nombre: '9B',
      grado: '10',
      archivada: true,
    });
    expect(() => leerCambiosClase({ nombre: '' })).toThrow();
    expect(() => leerCambiosClase({ nombre: 'x'.repeat(61) })).toThrow();
    expect(() => leerCambiosClase({ grado: '12' })).toThrow();
    expect(() => leerCambiosClase({ archivada: 'sí' })).toThrow();
    expect(() => leerCambiosClase({})).toThrow();
  });
});

describe('editarClase', () => {
  const nuevo = jest.fn(async () => 'NEW567');
  beforeEach(() => nuevo.mockClear());

  it('renombra y cambia el grado sin tocar el código', async () => {
    const db = base();
    await editarClase(comoDb(db), 'c1', 'k1', { nombre: '9B', grado: '10' }, nuevo, 5);
    expect(db.docs.get(CURSO)).toMatchObject({ nombre: '9B', grado: '10', codigo: 'ABC234' });
    expect(db.docs.has('classCodes/ABC234')).toBe(true);
    expect(nuevo).not.toHaveBeenCalled();
  });

  it('archivar desactiva el código y desarchivar lo recupera', async () => {
    const db = base();
    await editarClase(comoDb(db), 'c1', 'k1', { archivada: true }, nuevo, 5);
    expect(db.docs.get(CURSO)).toMatchObject({ archivada: true, archivadaAt: 5 });
    expect(db.docs.has('classCodes/ABC234')).toBe(false);

    const r = await editarClase(comoDb(db), 'c1', 'k1', { archivada: false }, nuevo, 6);
    expect(r.codigo).toBe('ABC234');
    expect(db.docs.get('classCodes/ABC234')).toMatchObject({ colegioId: 'c1', cursoId: 'k1' });
    expect(db.docs.get(CURSO)).toMatchObject({ archivada: false, archivadaAt: null });
  });

  it('si otra clase tomó el código, al reactivar usa uno nuevo', async () => {
    const db = base();
    await editarClase(comoDb(db), 'c1', 'k1', { codigoActivo: false }, nuevo);
    db.docs.set('classCodes/ABC234', { colegioId: 'c1', cursoId: 'otra' });
    const r = await editarClase(comoDb(db), 'c1', 'k1', { codigoActivo: true }, nuevo);
    expect(r.codigo).toBe('NEW567');
    expect(db.docs.get(CURSO)?.codigo).toBe('NEW567');
    expect(db.docs.get('classCodes/NEW567')?.cursoId).toBe('k1');
    expect(db.docs.get('classCodes/ABC234')?.cursoId).toBe('otra');
  });

  it('una clase archivada no reactiva el código aunque se pida', async () => {
    const db = base();
    await editarClase(comoDb(db), 'c1', 'k1', { archivada: true }, nuevo);
    await editarClase(comoDb(db), 'c1', 'k1', { codigoActivo: true }, nuevo);
    expect(db.docs.has('classCodes/ABC234')).toBe(false);
  });

  it('falla si la clase no existe', async () => {
    await expect(
      editarClase(comoDb(base()), 'c1', 'nope', { nombre: 'x' }, nuevo)
    ).rejects.toThrow();
  });
});

describe('borrarClase', () => {
  it('no deja borrar con estudiantes en la clase', async () => {
    const db = base();
    await expect(borrarClase(comoDb(db), 'c1', 'k1', async () => undefined)).rejects.toMatchObject({
      details: { codigo: 'clase_con_estudiantes' },
    });
  });

  it('con solo retirados o suprimidos borra código, tareas y el árbol', async () => {
    const db = base();
    db.docs.set(`${CURSO}/estudiantes/ana`, { estado: 'retirado' });
    db.docs.set(`${CURSO}/estudiantes/leo`, { estado: 'retirado' });
    db.docs.set('colegios/c1/asignaciones/a1', { target: { tipo: 'curso', cursoId: 'k1' } });
    db.docs.set('colegios/c1/asignaciones/a2', { target: { tipo: 'curso', cursoId: 'otra' } });
    const borradas: string[] = [];
    await borrarClase(comoDb(db), 'c1', 'k1', async (ref) => {
      borradas.push(ref.path);
    });
    expect(borradas).toEqual([CURSO]);
    expect(db.docs.has('classCodes/ABC234')).toBe(false);
    expect(db.docs.has('colegios/c1/asignaciones/a1')).toBe(false);
    expect(db.docs.has('colegios/c1/asignaciones/a2')).toBe(true);
  });
});

describe('contarClasesActivas', () => {
  it('no cuenta las archivadas ni las de otros profes', async () => {
    const db = new FirestoreFalso({
      'colegios/c1/cursos/a': { profesorUids: ['p1'] },
      'colegios/c1/cursos/b': { profesorUids: ['p1'], archivada: true },
      'colegios/c1/cursos/c': { profesorUids: ['p1'], archivada: false },
      'colegios/c1/cursos/d': { profesorUids: ['p2'] },
    });
    expect(await contarClasesActivas(comoDb(db), 'p1', 'c1')).toBe(2);
  });
});
