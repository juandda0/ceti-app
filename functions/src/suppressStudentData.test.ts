const mockRecursiveDelete = jest.fn().mockResolvedValue(undefined);
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockUsageDocs = [
  { id: 'student_1_2026-08-29', ref: { path: 'usage/own' } },
  { id: 'student_10_2026-08-29', ref: { path: 'usage/other' } },
];
const mockUsageQuery = {
  orderBy: jest.fn(),
  startAt: jest.fn(),
  endAt: jest.fn(),
  limit: jest.fn(),
  get: jest.fn().mockResolvedValue({ docs: mockUsageDocs, size: mockUsageDocs.length }),
};
mockUsageQuery.orderBy.mockReturnValue(mockUsageQuery);
mockUsageQuery.startAt.mockReturnValue(mockUsageQuery);
mockUsageQuery.endAt.mockReturnValue(mockUsageQuery);
mockUsageQuery.limit.mockReturnValue(mockUsageQuery);

const mockFirestore = {
  doc: jest.fn((path: string) => ({
    path,
    collection: jest.fn((name: string) => ({ path: `${path}/${name}` })),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue({ get: () => (path.endsWith('/acudiente/datos') ? 'tok' : undefined) }),
  })),
  collection: jest.fn(() => mockUsageQuery),
  recursiveDelete: mockRecursiveDelete,
  batch: jest.fn(() => ({ delete: mockBatchDelete, commit: mockBatchCommit })),
};

jest.mock('firebase-functions/v2/https', () => ({
  onCall: (_options: unknown, handler?: unknown) => handler ?? _options,
  onRequest: jest.fn(),
  HttpsError: class HttpsError extends Error {},
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
jest.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ setCustomUserClaims: jest.fn().mockResolvedValue(undefined) }),
}));
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockFirestore,
  FieldValue: { serverTimestamp: jest.fn(), increment: jest.fn() },
  FieldPath: { documentId: () => '__name__' },
}));
// Ceti Educadores: tareas programadas y cobros no participan de esta prueba.
jest.mock('./educadores/bitacoraSemanal', () => ({}));
jest.mock('./educadores/suscripciones', () => ({}));

// El import debe ocurrir después de instalar los mocks de Firebase.
// eslint-disable-next-line import/first
import { suppressStudentData } from './index';

test('la supresión elimina solo todos los contadores IA del UID exacto en un batch', async () => {
  await (suppressStudentData as unknown as (request: unknown) => Promise<unknown>)({
    auth: { uid: 'admin', token: { role: 'admin' } },
    data: { colegioId: 'school', cursoId: 'course', uid: 'student_1' },
  });

  expect(mockFirestore.collection).toHaveBeenCalledWith('financialAssistantUsage');
  expect(mockUsageQuery.limit).toHaveBeenCalledWith(400);
  expect(mockBatchDelete).toHaveBeenCalledTimes(1);
  expect(mockBatchDelete).toHaveBeenCalledWith(mockUsageDocs[0].ref);
  expect(mockBatchCommit).toHaveBeenCalledTimes(1);
});

test('la supresión también borra lo de la Fase 5: buzón, acudiente, su enlace y los avisos', async () => {
  mockRecursiveDelete.mockClear();
  mockFirestore.doc.mockClear();
  await (suppressStudentData as unknown as (request: unknown) => Promise<unknown>)({
    auth: { uid: 'admin', token: { role: 'admin' } },
    data: { colegioId: 'school', cursoId: 'course', uid: 'student_1' },
  });
  const borrados = mockRecursiveDelete.mock.calls.map(([ref]) => (ref as { path: string }).path);
  const est = 'colegios/school/cursos/course/estudiantes/student_1';
  expect(borrados).toEqual(
    expect.arrayContaining([`${est}/buzon`, `${est}/acudiente`, 'notificaciones/student_1'])
  );
  const enlace = mockFirestore.doc.mock.results.find(
    (r) => (r.value as { path: string }).path === 'enlacesAcudiente/tok'
  );
  expect((enlace?.value as { delete: jest.Mock }).delete).toHaveBeenCalled();
});

test('la supresión también borra lo de la Fase 8: adaptaciones e insignias', async () => {
  mockRecursiveDelete.mockClear();
  await (suppressStudentData as unknown as (request: unknown) => Promise<unknown>)({
    auth: { uid: 'admin', token: { role: 'admin' } },
    data: { colegioId: 'school', cursoId: 'course', uid: 'student_1' },
  });
  const borrados = mockRecursiveDelete.mock.calls.map(([ref]) => (ref as { path?: string }).path);
  const est = 'colegios/school/cursos/course/estudiantes/student_1';
  expect(borrados).toEqual(expect.arrayContaining([`${est}/adaptaciones`, `${est}/insignias`]));
});
