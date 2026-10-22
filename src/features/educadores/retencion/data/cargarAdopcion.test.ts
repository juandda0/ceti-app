// jest.mock se eleva sobre los imports (babel-jest).
jest.mock('firebase/firestore', () => ({}));
jest.mock('@shared/lib/firebase/app', () => ({ getFirebaseClients: () => null }));

import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { agregadosRepository } from '@features/dashboard/data/agregadosRepository';
import { DIA_MS } from '@/functions/src/educadores/dominio';
import { adopcionRepository } from './adopcionRepository';
import { cargarAdopcion } from './cargarAdopcion';

const AHORA = Date.parse('2026-10-22T15:00:00.000Z');

const agregado = {
  profes: 6,
  profesActivos: 4,
  cursos: 7,
  estudiantes: 218,
  estudiantesActivos: 132,
  adopcion: 132 / 218,
  cumpleMeta: false,
  senalNave: true,
  actualizadoAt: AHORA,
};

beforeEach(() => {
  rosterRepository.getAllCursos = jest.fn(async () => {
    throw new Error('permission-denied');
  });
  rosterRepository.getCursosByProfesor = jest.fn(async () => [
    { id: 'c1', nombre: '9A', grado: '9' as const, profesorUids: ['yo'] },
  ]);
  rosterRepository.getRoster = jest.fn(async () => [
    { uid: 'a', email: '', nombre: '', estado: 'activo' as const, atestado: true, joinedAt: 0 },
    { uid: 'b', email: '', nombre: '', estado: 'activo' as const, atestado: true, joinedAt: 0 },
  ]);
  agregadosRepository.getResumen = jest.fn(async () => ({
    colegioId: 'col',
    cursoId: 'c1',
    porCompetencia: {},
    porMundo: {},
    estudiantesActivos: 1,
    masteryPromedio: 0.5,
    porcentajeCompletado: 0,
    actualizadoAt: AHORA - DIA_MS,
  }));
});

describe('cargarAdopcion', () => {
  it('usa el agregado del colegio cuando existe', async () => {
    adopcionRepository.leerAgregado = jest.fn(async () => agregado);
    expect(await cargarAdopcion('col', 'yo', AHORA)).toEqual(agregado);
    expect(rosterRepository.getAllCursos).not.toHaveBeenCalled();
  });

  it('si aún no existe (o no se puede leer), calcula con las clases visibles', async () => {
    for (const leer of [async () => null, async () => Promise.reject(new Error('x'))]) {
      adopcionRepository.leerAgregado = jest.fn(leer);
      expect(await cargarAdopcion('col', 'yo', AHORA)).toEqual({
        profes: 1,
        profesActivos: 1,
        cursos: 1,
        estudiantes: 2,
        estudiantesActivos: 1,
        adopcion: 0.5,
        cumpleMeta: false,
        senalNave: false,
        actualizadoAt: null,
      });
    }
  });
});
