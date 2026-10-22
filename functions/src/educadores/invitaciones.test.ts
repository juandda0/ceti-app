const mockDb: { actual: unknown } = { actual: null };

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
jest.mock('firebase-admin/firestore', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { incremento } = require('./firestoreFalso.test');
  return {
    getFirestore: () => mockDb.actual,
    FieldValue: { increment: incremento, serverTimestamp: () => 'ts' },
  };
});

// eslint-disable-next-line import/first
import { leerLista, nuevaSuscripcion } from './dominio';
// eslint-disable-next-line import/first
import { aDoc } from './plan';
// eslint-disable-next-line import/first
import {
  cerrarInvitacion,
  debeEnviarInvitacion,
  enviarInvitacion,
  invitacionDeCorreo,
  invitarLista,
  repartirInvitados,
  type ResultadoInvitarLista,
} from './invitaciones';
// eslint-disable-next-line import/first
import { FirestoreFalso } from './firestoreFalso.test';

type Llamada = (req: unknown) => Promise<ResultadoInvitarLista>;
const llamar = invitarLista as unknown as Llamada;
const PROFE = { uid: 'p1', token: { role: 'profesor', colegioId: 'col', name: 'Profe Marta' } };

function nuevoDb(extra: Record<string, Record<string, unknown>> = {}) {
  const db = new FirestoreFalso({
    'colegios/col/cursos/c1': { profesorUids: ['p1'], nombre: 'Finanzas 9A' },
    ...extra,
  });
  mockDb.actual = db;
  return db;
}

type Correo = { to: string; message: { subject: string; text: string } };
const correos = (db: FirestoreFalso) =>
  [...db.docs.entries()].filter(([p]) => p.startsWith('mail/')).map(([, d]) => d as Correo);

async function fallo(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? 'sin_codigo';
  }
}

describe('repartirInvitados', () => {
  it('separa nuevos, ya en clase y sin cupo', () => {
    const lista = leerLista('a@x.co\nb@x.co\nc@x.co\na@x.co\nsin correo');
    const r = repartirInvitados(lista, new Set(['b@x.co']), 1);
    expect(r.invitados.map((i) => i.correo)).toEqual(['a@x.co']);
    expect(r.sinCupo.map((i) => i.correo)).toEqual(['c@x.co']);
    expect(r.duplicados).toBe(2);
    expect(r.errores).toHaveLength(1);
  });

  it('un correo con / no puede ser id de documento', () => {
    const r = repartirInvitados(leerLista('a/b@x.co'), new Set(), 10);
    expect(r.invitados).toEqual([]);
    expect(r.errores[0]).toMatchObject({ motivo: 'correo_invalido', texto: 'a/b@x.co' });
  });
});

describe('invitarLista', () => {
  it('solo un profe de la clase', async () => {
    nuevoDb();
    const datos = { colegioId: 'col', cursoId: 'c1', texto: 'a@x.co' };
    expect(
      await fallo(
        llamar({ auth: { uid: 'e', token: { role: 'estudiante', colegioId: 'col' } }, data: datos })
      )
    ).toBe('permission-denied');
    expect(
      await fallo(
        llamar({ auth: { uid: 'p2', token: { role: 'profesor', colegioId: 'col' } }, data: datos })
      )
    ).toBe('permission-denied');
    expect(
      await fallo(
        llamar({ auth: { uid: 'p1', token: { role: 'profesor', colegioId: 'otro' } }, data: datos })
      )
    ).toBe('permission-denied');
    expect(await fallo(llamar({ auth: PROFE, data: { ...datos, texto: '' } }))).toBe(
      'invalid-argument'
    );
  });

  it('escribe el invitado y el doc de búsqueda', async () => {
    const db = nuevoDb();
    const r = await llamar({
      auth: PROFE,
      data: {
        colegioId: 'col',
        cursoId: 'c1',
        texto: 'Nombre\tCorreo\nAna Pérez\tANA@colegio.edu.co\nLuis\tsin-correo',
      },
    });
    expect(r.invitados).toEqual([{ nombre: 'Ana Pérez', correo: 'ana@colegio.edu.co' }]);
    expect(r.errores).toHaveLength(1);
    expect(r.sinCupo).toEqual([]);
    expect(db.datos('colegios/col/cursos/c1/invitados/ana@colegio.edu.co')).toMatchObject({
      correo: 'ana@colegio.edu.co',
      nombre: 'Ana Pérez',
      estado: 'pendiente',
      invitadoPor: 'p1',
    });
    expect(db.datos('invitacionesPorCorreo/ana@colegio.edu.co')).toMatchObject({
      colegioId: 'col',
      cursoId: 'c1',
    });
  });

  it('no repite a quien ya está invitado o en el roster', async () => {
    nuevoDb({
      'colegios/col/cursos/c1/invitados/a@x.co': { estado: 'pendiente' },
      'colegios/col/cursos/c1/estudiantes/u1': { email: 'B@x.co', estado: 'activo' },
      'colegios/col/cursos/c1/estudiantes/u2': { email: 'c@x.co', estado: 'suprimido' },
    });
    const r = await llamar({
      auth: PROFE,
      data: { colegioId: 'col', cursoId: 'c1', texto: 'a@x.co\nb@x.co\nc@x.co' },
    });
    expect(r.invitados.map((i) => i.correo)).toEqual(['c@x.co']);
    expect(r.duplicados).toBe(2);
  });

  it('no invita más de lo que cabe en el plan (roster + pendientes)', async () => {
    const extra: Record<string, Record<string, unknown>> = {};
    // Cadete: 45 por clase. 40 en el roster + 3 pendientes = 2 cupos.
    for (let i = 0; i < 40; i++)
      extra[`colegios/col/cursos/c1/estudiantes/e${i}`] = { email: `e${i}@x.co`, estado: 'activo' };
    for (let i = 0; i < 3; i++)
      extra[`colegios/col/cursos/c1/invitados/p${i}@x.co`] = { estado: 'pendiente' };
    extra['colegios/col/cursos/c1/invitados/unido@x.co'] = { estado: 'unido' };
    nuevoDb(extra);
    const r = await llamar({
      auth: PROFE,
      data: { colegioId: 'col', cursoId: 'c1', texto: 'n1@x.co\nn2@x.co\nn3@x.co' },
    });
    expect(r.invitados.map((i) => i.correo)).toEqual(['n1@x.co', 'n2@x.co']);
    expect(r.sinCupo.map((i) => i.correo)).toEqual(['n3@x.co']);
    expect(r.sinCupoPor).toBe('clase');
  });

  it('en la prueba de Piloto caben 60', async () => {
    const extra: Record<string, Record<string, unknown>> = {
      'suscripciones/p1': aDoc(nuevaSuscripcion('p1', Date.now())),
    };
    for (let i = 0; i < 45; i++)
      extra[`colegios/col/cursos/c1/estudiantes/e${i}`] = { email: `e${i}@x.co`, estado: 'activo' };
    nuevoDb(extra);
    const r = await llamar({
      auth: PROFE,
      data: { colegioId: 'col', cursoId: 'c1', texto: 'n1@x.co' },
    });
    expect(r.invitados).toHaveLength(1);
  });
});

describe('correo de invitación', () => {
  it('debeEnviarInvitacion: solo pendientes que aún no lo recibieron', () => {
    expect(debeEnviarInvitacion({ estado: 'pendiente' })).toBe(true);
    expect(debeEnviarInvitacion({ estado: 'pendiente', correoEnviadoAt: 1 })).toBe(false);
    expect(debeEnviarInvitacion({ estado: 'unido' })).toBe(false);
    expect(debeEnviarInvitacion(undefined)).toBe(false);
  });

  it('cada invitado nuevo recibe un correo y queda marcado', async () => {
    const db = nuevoDb();
    const r = await llamar({
      auth: PROFE,
      data: { colegioId: 'col', cursoId: 'c1', texto: 'Ana\tana@x.co\nLuis\tluis@x.co' },
    });
    expect(r.correosEnviados).toBe(2);
    const enviados = correos(db);
    expect(enviados.map((c) => c.to).sort()).toEqual(['ana@x.co', 'luis@x.co']);
    const ana = enviados.find((c) => c.to === 'ana@x.co')!;
    expect(ana.message.subject).toBe('Profe Marta te invitó a Finanzas 9A en Ceti');
    expect(ana.message.text).toContain('este mismo correo (ana@x.co)');
    expect(ana.message.text).toContain('https://ceti-d3769.web.app');
    // Sin datos de otros: ni el nombre que escribió el profe ni otros correos.
    expect(ana.message.text).not.toContain('Ana');
    expect(ana.message.text).not.toContain('luis@x.co');
    expect(db.datos('colegios/col/cursos/c1/invitados/ana@x.co')?.correoEnviadoAt).toEqual(
      expect.any(Number)
    );
  });

  it('no reenvía: pegar la misma lista otra vez no manda más correos', async () => {
    const db = nuevoDb();
    const datos = { colegioId: 'col', cursoId: 'c1', texto: 'ana@x.co' };
    await llamar({ auth: PROFE, data: datos });
    const r = await llamar({ auth: PROFE, data: datos });
    expect(r.duplicados).toBe(1);
    expect(r.correosEnviados).toBe(0);
    expect(correos(db)).toHaveLength(1);
  });

  it('un pendiente de antes, sin correo, lo recibe una vez al volver a la lista', async () => {
    const db = nuevoDb({
      'colegios/col/cursos/c1/invitados/vieja@x.co': { correo: 'vieja@x.co', estado: 'pendiente' },
      'colegios/col/cursos/c1/invitados/unida@x.co': { correo: 'unida@x.co', estado: 'unido' },
    });
    const datos = { colegioId: 'col', cursoId: 'c1', texto: 'vieja@x.co\nunida@x.co' };
    expect((await llamar({ auth: PROFE, data: datos })).correosEnviados).toBe(1);
    expect((await llamar({ auth: PROFE, data: datos })).correosEnviados).toBe(0);
    expect(correos(db).map((c) => c.to)).toEqual(['vieja@x.co']);
  });

  it('enviarInvitacion es idempotente', async () => {
    const db = nuevoDb({ 'colegios/col/cursos/c1/invitados/a@x.co': { estado: 'pendiente' } });
    const d = db as unknown as FirebaseFirestore.Firestore;
    const datos = { clase: '9A', profe: null, enlace: 'https://x' };
    expect(await enviarInvitacion(d, 'col', 'c1', 'a@x.co', datos)).toBe(true);
    expect(await enviarInvitacion(d, 'col', 'c1', 'a@x.co', datos)).toBe(false);
    expect(await enviarInvitacion(d, 'col', 'c1', 'nadie@x.co', datos)).toBe(false);
    expect(correos(db)).toHaveLength(1);
  });
});

describe('invitarLista con licencia Nave', () => {
  const LIC = { plan: 'nave', hasta: Date.now() + 86_400_000, estudiantes: 10 };

  it('no reparte más cupos que la licencia con margen, contando todo el colegio', async () => {
    const extra: Record<string, Record<string, unknown>> = {
      'colegios/col': { nombre: 'Colegio Sol', licencia: LIC },
      'colegios/col/cursos/c2': { profesorUids: ['otro'] },
      'colegios/col/cursos/c2/invitados/q@x.co': { estado: 'pendiente' },
    };
    for (let i = 0; i < 9; i++)
      extra[`colegios/col/cursos/c2/estudiantes/e${i}`] = { email: `e${i}@x.co`, estado: 'activo' };
    const db = nuevoDb(extra);
    // 9 + 1 pendiente = 10 ocupados; tope 11 → cabe 1.
    const r = await llamar({
      auth: PROFE,
      data: { colegioId: 'col', cursoId: 'c1', texto: 'n1@x.co\nn2@x.co\nn3@x.co' },
    });
    expect(r.invitados.map((i) => i.correo)).toEqual(['n1@x.co']);
    expect(r.sinCupo.map((i) => i.correo)).toEqual(['n2@x.co', 'n3@x.co']);
    expect(r.sinCupoPor).toBe('colegio');
    const ops = correos(db).filter((c) => c.message.subject.startsWith('Nave:'));
    expect(ops).toHaveLength(1);
    expect(ops[0].message.text).toContain('Ocupados ahora: 11');
  });

  it('dentro de la licencia no avisa a operaciones', async () => {
    const db = nuevoDb({ 'colegios/col': { licencia: LIC } });
    const r = await llamar({
      auth: PROFE,
      data: { colegioId: 'col', cursoId: 'c1', texto: 'n1@x.co\nn2@x.co' },
    });
    expect(r.invitados).toHaveLength(2);
    expect(r.sinCupoPor).toBeUndefined();
    expect(correos(db).every((c) => !c.message.subject.startsWith('Nave:'))).toBe(true);
  });
});

describe('unión por invitación', () => {
  it('encuentra la invitación pendiente y la cierra', async () => {
    const db = nuevoDb({
      'invitacionesPorCorreo/ana@x.co': { colegioId: 'col', cursoId: 'c1', creadoAt: 1 },
      'colegios/col/cursos/c1/invitados/ana@x.co': {
        correo: 'ana@x.co',
        nombre: 'Ana',
        estado: 'pendiente',
      },
    });
    const d = db as unknown as FirebaseFirestore.Firestore;
    const inv = await invitacionDeCorreo('ANA@x.co', d);
    expect(inv).toEqual({ correo: 'ana@x.co', colegioId: 'col', cursoId: 'c1', nombre: 'Ana' });
    await cerrarInvitacion(inv!, 'uid-ana', d);
    expect(db.datos('colegios/col/cursos/c1/invitados/ana@x.co')).toMatchObject({
      estado: 'unido',
      uid: 'uid-ana',
    });
    expect(db.datos('invitacionesPorCorreo/ana@x.co')).toBeUndefined();
  });

  it('limpia una búsqueda que apunta a una invitación cerrada o a una clase borrada', async () => {
    const db = nuevoDb({
      'invitacionesPorCorreo/a@x.co': { colegioId: 'col', cursoId: 'c1' },
      'colegios/col/cursos/c1/invitados/a@x.co': { estado: 'unido' },
      'invitacionesPorCorreo/b@x.co': { colegioId: 'col', cursoId: 'borrada' },
    });
    const d = db as unknown as FirebaseFirestore.Firestore;
    expect(await invitacionDeCorreo('a@x.co', d)).toBeNull();
    expect(await invitacionDeCorreo('b@x.co', d)).toBeNull();
    expect(await invitacionDeCorreo(undefined, d)).toBeNull();
    expect(db.datos('invitacionesPorCorreo/a@x.co')).toBeUndefined();
    expect(db.datos('invitacionesPorCorreo/b@x.co')).toBeUndefined();
  });
});
