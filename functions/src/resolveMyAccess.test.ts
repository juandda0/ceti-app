const mockSetCustomUserClaims = jest.fn().mockResolvedValue(undefined);
const mockSet = jest.fn().mockResolvedValue(undefined);
const mockDocs: Record<string, Record<string, unknown>> = {};
const mockGet = jest.fn().mockResolvedValue({ exists: false, data: () => undefined });
const mockColegioRef = { id: 'colegio-propio', set: mockSet, get: mockGet };
const mockDoc = jest.fn((path: string) => ({
  get: async () =>
    mockDocs[path]
      ? { exists: true, data: () => mockDocs[path] }
      : { exists: false, data: () => undefined },
  set: (d: unknown) => mockSet(path, d),
}));

// Ceti Educadores: el plan, los límites y las invitaciones se prueban en
// educadores/*.test.ts; aquí solo se verifica cómo los usa index.ts.
const mockSubExiste = { valor: false };
const mockAsegurarSuscripcion = jest.fn().mockResolvedValue(undefined);
const mockInvitacionDeCorreo = jest.fn().mockResolvedValue(null);
const mockCerrarInvitacion = jest.fn().mockResolvedValue(undefined);
const mockAsegurarCupo = jest.fn().mockResolvedValue(undefined);
const mockAsegurarClase = jest.fn().mockResolvedValue(undefined);
const mockAsegurarIa = jest.fn().mockResolvedValue('piloto');
const mockRegistrarIa = jest.fn().mockResolvedValue(undefined);
const mockGenerarBorrador = jest.fn().mockResolvedValue({ borrador: true });

jest.mock('firebase-functions/v2/https', () => ({
  onCall: (_options: unknown, handler?: unknown) => handler ?? _options,
  onRequest: jest.fn(),
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
jest.mock('firebase-functions/v2/firestore', () => ({
  onDocumentWritten: jest.fn(),
  onDocumentCreated: jest.fn(),
}));
jest.mock('firebase-functions/v2/scheduler', () => ({ onSchedule: jest.fn() }));
jest.mock('firebase-functions/params', () => ({
  defineSecret: () => ({ value: () => 'test' }),
  defineString: () => ({ value: () => '' }),
}));
jest.mock('firebase-admin/app', () => ({ initializeApp: jest.fn() }));
const mockClaimsActuales: { valor: Record<string, unknown> } = { valor: {} };
jest.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    setCustomUserClaims: mockSetCustomUserClaims,
    getUser: async () => ({ customClaims: mockClaimsActuales.valor }),
  }),
}));
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    doc: mockDoc,
    collection: jest.fn(() => ({ doc: jest.fn(() => mockColegioRef) })),
  }),
  FieldValue: { serverTimestamp: jest.fn(), increment: jest.fn() },
  FieldPath: { documentId: () => '__name__' },
}));
jest.mock('./educadores/plan', () => ({
  refSuscripcion: () => ({ get: async () => ({ exists: mockSubExiste.valor }) }),
  asegurarSuscripcion: (uid: string) => mockAsegurarSuscripcion(uid),
}));
jest.mock('./educadores/invitaciones', () => ({
  invitacionDeCorreo: (correo: unknown) => mockInvitacionDeCorreo(correo),
  cerrarInvitacion: (inv: unknown, uid: unknown) => mockCerrarInvitacion(inv, uid),
}));
jest.mock('./educadores/limites', () => ({
  asegurarCupoEstudiante: (...a: unknown[]) => mockAsegurarCupo(...a),
  asegurarPuedeCrearClase: (...a: unknown[]) => mockAsegurarClase(...a),
  asegurarIaDisponible: (...a: unknown[]) => mockAsegurarIa(...a),
  registrarGeneracionIa: (...a: unknown[]) => mockRegistrarIa(...a),
}));
jest.mock('./educadores/bitacoraSemanal', () => ({}));
jest.mock('./educadores/suscripciones', () => ({}));
jest.mock('./mundoBorrador', () => ({
  ...jest.requireActual('./mundoBorrador'),
  generarBorrador: (...a: unknown[]) => mockGenerarBorrador(...a),
}));

// El import debe ocurrir después de instalar los mocks de Firebase.
// eslint-disable-next-line import/first
import { crearMiCurso, generarBorradorMundo, joinByCode, resolveMyAccess } from './index';

type Callable = (request: unknown) => Promise<unknown>;
const call = (fn: unknown, request: unknown) => (fn as Callable)(request);

function limiteError(codigo: string) {
  return Object.assign(new Error(codigo), { code: 'resource-exhausted', details: { codigo } });
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockDocs)) delete mockDocs[k];
  mockSubExiste.valor = false;
  mockInvitacionDeCorreo.mockResolvedValue(null);
  mockAsegurarCupo.mockResolvedValue(undefined);
  mockAsegurarClase.mockResolvedValue(undefined);
  mockAsegurarIa.mockResolvedValue('piloto');
});

test('crea un colegio propio y activa a quien se registra como profesor', async () => {
  const result = await call(resolveMyAccess, {
    auth: { uid: 'profesor-nuevo', token: { email: 'profe@example.com' } },
    data: { requestedRole: 'profesor' },
  });

  expect(result).toEqual({ role: 'profesor', colegioId: 'colegio-propio', cursoId: null });
  expect(mockSetCustomUserClaims).toHaveBeenCalledWith('profesor-nuevo', {
    role: 'profesor',
    colegioId: 'colegio-propio',
  });
  expect(mockDoc).toHaveBeenCalledTimes(1);
  expect(mockDoc).toHaveBeenCalledWith('membership/profesor-nuevo');
  // Ceti Educadores: nace con la prueba de Piloto de 14 días.
  expect(mockAsegurarSuscripcion).toHaveBeenCalledWith('profesor-nuevo');
});

test('activa a una persona invitada como estudiante sin asignarle una clase', async () => {
  const result = await call(resolveMyAccess, {
    auth: { uid: 'invitada', token: { email: 'invitada@example.com' } },
    data: {},
  });

  expect(result).toEqual({ role: 'estudiante', colegioId: null, cursoId: null });
  expect(mockSetCustomUserClaims).toHaveBeenCalledWith('invitada', { role: 'estudiante' });
  expect(mockDoc).toHaveBeenCalledWith('membership/invitada');
  expect(mockInvitacionDeCorreo).toHaveBeenCalledWith('invitada@example.com');
});

describe('Ceti Educadores', () => {
  test('un profe que ya existía recibe la prueba solo si no tiene suscripción', async () => {
    const req = { auth: { uid: 'p1', token: { role: 'profesor', colegioId: 'col' } }, data: {} };
    expect(await call(resolveMyAccess, req)).toEqual({
      role: 'profesor',
      colegioId: 'col',
      cursoId: null,
    });
    expect(mockAsegurarSuscripcion).toHaveBeenCalledWith('p1');

    mockAsegurarSuscripcion.mockClear();
    mockSubExiste.valor = true;
    await call(resolveMyAccess, req);
    expect(mockAsegurarSuscripcion).not.toHaveBeenCalled();
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  test('un fallo al crear la prueba no bloquea el inicio de sesión', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockAsegurarSuscripcion.mockRejectedValueOnce(new Error('boom'));
    const r = await call(resolveMyAccess, {
      auth: { uid: 'p1', token: { role: 'profesor', colegioId: 'col' } },
    });
    expect(r).toEqual({ role: 'profesor', colegioId: 'col', cursoId: null });
  });

  const INV = { correo: 'ana@x.co', colegioId: 'col', cursoId: 'c1', nombre: 'Ana Pérez' };

  test('un estudiante invitado por correo entra directo a su clase', async () => {
    mockInvitacionDeCorreo.mockResolvedValue(INV);
    const r = await call(resolveMyAccess, {
      auth: { uid: 'ana', token: { email: 'Ana@x.co' } },
      data: {},
    });

    expect(r).toEqual({ role: 'estudiante', colegioId: 'col', cursoId: 'c1' });
    expect(mockAsegurarCupo).toHaveBeenCalledWith('col', 'c1', expect.anything());
    expect(mockSet).toHaveBeenCalledWith(
      'colegios/col/cursos/c1/estudiantes/ana',
      expect.objectContaining({
        email: 'Ana@x.co',
        nombre: 'Ana Pérez',
        estado: 'pendiente_atestacion',
      })
    );
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('ana', {
      role: 'estudiante',
      clases: { c1: 'col' },
    });
    expect(mockCerrarInvitacion).toHaveBeenCalledWith(INV, 'ana');
  });

  test('un estudiante con cuenta usa la invitación, tenga o no otras clases', async () => {
    mockInvitacionDeCorreo.mockResolvedValue(INV);
    const r = await call(resolveMyAccess, {
      auth: { uid: 'ana', token: { role: 'estudiante', email: 'ana@x.co' } },
    });
    expect(r).toEqual({
      role: 'estudiante',
      colegioId: 'col',
      cursoId: 'c1',
      clases: { c1: 'col' },
    });

    // Ya estaba en otra clase (token de antes): se suma la nueva.
    const r2 = await call(resolveMyAccess, {
      auth: {
        uid: 'ana',
        token: { role: 'estudiante', email: 'ana@x.co', colegioId: 'otro', cursoId: 'c0' },
      },
    });
    expect(r2).toMatchObject({ clases: { c0: 'otro', c1: 'col' } });
  });

  test('si la clase está llena entra como invitado y la invitación queda pendiente', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockInvitacionDeCorreo.mockResolvedValue(INV);
    mockAsegurarCupo.mockRejectedValue(limiteError('limite_estudiantes'));
    const r = await call(resolveMyAccess, {
      auth: { uid: 'ana', token: { email: 'ana@x.co' } },
      data: {},
    });

    expect(r).toEqual({ role: 'estudiante', colegioId: null, cursoId: null });
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('ana', { role: 'estudiante' });
    expect(mockCerrarInvitacion).not.toHaveBeenCalled();
  });

  test('joinByCode respeta el cupo del plan solo para un cupo nuevo', async () => {
    mockDocs['classCodes/ABC123'] = { colegioId: 'col', cursoId: 'c1' };
    mockAsegurarCupo.mockRejectedValue(limiteError('limite_estudiantes'));
    const req = { auth: { uid: 'e1', token: { email: 'e1@x.co' } }, data: { code: 'abc123' } };
    await expect(call(joinByCode, req)).rejects.toMatchObject({
      details: { codigo: 'limite_estudiantes' },
    });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();

    // Ya tenía cupo en el roster: entra aunque la clase esté llena.
    mockDocs['colegios/col/cursos/c1/estudiantes/e1'] = { estado: 'activo' };
    expect(await call(joinByCode, req)).toEqual({ ok: true, colegioId: 'col', cursoId: 'c1' });
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('e1', {
      role: 'estudiante',
      clases: { c1: 'col' },
    });
  });

  test('joinByCode suma la clase sin sacarlo de las que ya tenía (hasta 5)', async () => {
    mockDocs['classCodes/ABC123'] = { colegioId: 'col', cursoId: 'c1' };
    mockClaimsActuales.valor = { role: 'estudiante', clases: { c0: 'otro' } };
    const req = {
      auth: { uid: 'e1', token: { email: 'e1@x.co', role: 'estudiante' } },
      data: { code: 'ABC123', nombre: '  Ana   Pérez ' },
    };
    expect(await call(joinByCode, req)).toEqual({ ok: true, colegioId: 'col', cursoId: 'c1' });
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('e1', {
      role: 'estudiante',
      clases: { c0: 'otro', c1: 'col' },
    });
    expect(mockSet).toHaveBeenCalledWith(
      'colegios/col/cursos/c1/estudiantes/e1',
      expect.objectContaining({ nombre: 'Ana Pérez', estado: 'pendiente_atestacion' })
    );
    expect(mockSet).not.toHaveBeenCalledWith(expect.stringContaining('/c0/'), expect.anything());

    // Con 5 clases ya no entra a una sexta.
    mockSetCustomUserClaims.mockClear();
    mockClaimsActuales.valor = {
      role: 'estudiante',
      clases: { a: 'x', b: 'x', c: 'x', d: 'x', e: 'x' },
    };
    await expect(call(joinByCode, req)).rejects.toMatchObject({
      details: { codigo: 'limite_clases_estudiante' },
    });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    mockClaimsActuales.valor = {};
  });

  test('joinByCode cierra la invitación por correo a la misma clase', async () => {
    mockDocs['classCodes/ABC123'] = { colegioId: 'col', cursoId: 'c1' };
    mockInvitacionDeCorreo.mockResolvedValue(INV);
    await call(joinByCode, {
      auth: { uid: 'ana', token: { email: 'ana@x.co' } },
      data: { code: 'ABC123' },
    });
    expect(mockCerrarInvitacion).toHaveBeenCalledWith(INV, 'ana');
  });

  test('crearMiCurso no crea nada si el plan no admite otra clase', async () => {
    mockAsegurarClase.mockRejectedValue(limiteError('limite_clases'));
    const req = {
      auth: { uid: 'p1', token: { role: 'profesor', colegioId: 'col' } },
      data: { nombre: '9B', grado: '9' },
    };
    await expect(call(crearMiCurso, req)).rejects.toMatchObject({
      details: { codigo: 'limite_clases' },
    });
    expect(mockAsegurarClase).toHaveBeenCalledWith('p1', 'col');
    expect(mockSet).not.toHaveBeenCalled();
  });

  test('generarBorradorMundo exige plan y cuenta solo las generaciones que salen bien', async () => {
    mockDocs['colegios/col/cursos/c1'] = { profesorUids: ['p1'] };
    const req = {
      auth: { uid: 'p1', token: { role: 'profesor', colegioId: 'col' } },
      data: { colegioId: 'col', cursoId: 'c1', nombre: 'Mundo', tema: 'Ahorro', grado: '9' },
    };
    mockAsegurarIa.mockRejectedValueOnce(
      Object.assign(new Error('x'), {
        code: 'failed-precondition',
        details: { codigo: 'requiere_plan' },
      })
    );
    await expect(call(generarBorradorMundo, req)).rejects.toMatchObject({
      details: { codigo: 'requiere_plan' },
    });
    expect(mockGenerarBorrador).not.toHaveBeenCalled();

    expect(await call(generarBorradorMundo, req)).toEqual({ borrador: true });
    expect(mockRegistrarIa).toHaveBeenCalledTimes(1);
    expect(mockRegistrarIa).toHaveBeenCalledWith('p1');

    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGenerarBorrador.mockRejectedValueOnce(new Error('groq'));
    await expect(call(generarBorradorMundo, req)).rejects.toBeDefined();
    expect(mockRegistrarIa).toHaveBeenCalledTimes(1);
  });
});
