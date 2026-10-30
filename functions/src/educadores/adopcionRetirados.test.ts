jest.mock('firebase-functions/v2/scheduler', () => ({ onSchedule: jest.fn() }));
jest.mock('firebase-functions/v2/https', () => ({ HttpsError: class extends Error {} }));
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(),
  FieldValue: { serverTimestamp: () => 'ts' },
}));

// eslint-disable-next-line import/first
import { cursoAdopcionDesdeDatos } from './adopcionColegio';

describe('adopción del colegio con estudiantes que salieron', () => {
  it('los retirados y suprimidos no cuentan en la lista ni en la actividad', () => {
    const ahora = Date.UTC(2026, 9, 30);
    const c = cursoAdopcionDesdeDatos(
      {
        profesorUids: ['p1'],
        roster: [
          { uid: 'ana', estado: 'activo' },
          { uid: 'leo', estado: 'pendiente_atestacion' },
          { uid: 'sol', estado: 'retirado' },
          { uid: 'zoe', estado: 'suprimido' },
        ],
        progreso: [
          { uid: 'ana', updatedAt: ahora - 1000 },
          { uid: 'sol', updatedAt: ahora - 500 },
        ],
      },
      ahora
    );
    expect(c.estudiantes).toBe(2);
    expect(c.estudiantesActivos).toBe(1);
    expect(c.ultimaActividad).toBe(ahora - 1000);
  });
});
