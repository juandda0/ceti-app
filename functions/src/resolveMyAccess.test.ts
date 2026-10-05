const mockSetCustomUserClaims = jest.fn().mockResolvedValue(undefined);
const mockSet = jest.fn().mockResolvedValue(undefined);
const mockGet = jest.fn().mockResolvedValue({ exists: false, data: () => undefined });
const mockColegioRef = { id: 'colegio-propio', set: mockSet, get: mockGet };
const mockDoc = jest.fn(() => ({ get: mockGet, set: mockSet }));

jest.mock('firebase-functions/v2/https', () => ({
  onCall: (_options: unknown, handler?: unknown) => handler ?? _options,
  HttpsError: class HttpsError extends Error {},
}));
jest.mock('firebase-functions/v2/firestore', () => ({ onDocumentWritten: jest.fn() }));
jest.mock('firebase-functions/params', () => ({
  defineSecret: () => ({ value: () => 'test' }),
}));
jest.mock('firebase-admin/app', () => ({ initializeApp: jest.fn() }));
jest.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ setCustomUserClaims: mockSetCustomUserClaims }),
}));
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    doc: mockDoc,
    collection: jest.fn(() => ({ doc: jest.fn(() => mockColegioRef) })),
  }),
  FieldValue: { serverTimestamp: jest.fn(), increment: jest.fn() },
  FieldPath: { documentId: () => '__name__' },
}));

// El import debe ocurrir después de instalar los mocks de Firebase.
// eslint-disable-next-line import/first
import { resolveMyAccess } from './index';

test('crea un colegio propio y activa a quien se registra como profesor', async () => {
  const result = await (resolveMyAccess as unknown as (request: unknown) => Promise<unknown>)({
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
});

test('activa a una persona invitada como estudiante sin asignarle una clase', async () => {
  mockSetCustomUserClaims.mockClear();
  mockDoc.mockClear();

  const result = await (resolveMyAccess as unknown as (request: unknown) => Promise<unknown>)({
    auth: { uid: 'invitada', token: { email: 'invitada@example.com' } },
    data: {},
  });

  expect(result).toEqual({ role: 'estudiante', colegioId: null, cursoId: null });
  expect(mockSetCustomUserClaims).toHaveBeenCalledWith('invitada', { role: 'estudiante' });
  expect(mockDoc).toHaveBeenCalledWith('membership/invitada');
});
