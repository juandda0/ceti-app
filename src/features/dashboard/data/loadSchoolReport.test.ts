// jest.mock se eleva sobre los imports (babel-jest).
jest.mock('firebase/firestore', () => ({}));
jest.mock('@shared/lib/firebase/app', () => ({ getFirebaseClients: () => null }));

import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { agregadosRepository } from '@features/dashboard/data/agregadosRepository';
import { adopcionRepository } from '@features/educadores/retencion/data/adopcionRepository';
import { loadSchoolReport } from './loadSchoolReport';

const AHORA = Date.parse('2026-10-29T15:00:00.000Z');

const resumen = (cursoId: string) => ({
  colegioId: 'col',
  cursoId,
  porCompetencia: {},
  porMundo: {},
  estudiantesActivos: 3,
  masteryPromedio: 0.6,
  porcentajeCompletado: 0.5,
  actualizadoAt: AHORA,
});

const ids = (r: { courseSummaries: { cursoId: string }[] }) =>
  r.courseSummaries.map((c) => c.cursoId).sort();

beforeEach(() => {
  rosterRepository.getAllCursos = jest.fn(async () => {
    throw new Error('permission-denied');
  });
  rosterRepository.getCursosByProfesor = jest.fn(async () => [
    { id: '10b', nombre: '10°B', grado: '10' as const, profesorUids: ['yo'] },
  ]);
  agregadosRepository.getResumen = jest.fn(async (_c: string, cursoId: string) => resumen(cursoId));
});

describe('loadSchoolReport', () => {
  it('toma las clases del colegio entero del agregado del servidor', async () => {
    adopcionRepository.leerCursos = jest.fn(async () => [
      { id: '10b', nombre: '10°B', grado: '10' },
      { id: '9a', nombre: '9°A', grado: '9' },
      { id: '8a', nombre: '8°A', grado: '8' },
    ]);
    const r = await loadSchoolReport('col', AHORA, 'yo');
    expect(ids(r)).toEqual(['10b', '8a', '9a']);
    expect(rosterRepository.getAllCursos).not.toHaveBeenCalled();
  });

  it('sin agregado, el profe (que no puede listar todas) ve sus propias clases', async () => {
    for (const leer of [async () => null, async () => Promise.reject(new Error('x'))]) {
      adopcionRepository.leerCursos = jest.fn(leer);
      const r = await loadSchoolReport('col', AHORA, 'yo');
      expect(ids(r)).toEqual(['10b']);
      expect(rosterRepository.getCursosByProfesor).toHaveBeenCalledWith('col', 'yo');
    }
  });

  it('un agregado por curso que falla no tumba el reporte', async () => {
    adopcionRepository.leerCursos = jest.fn(async () => [
      { id: '10b', nombre: '10°B', grado: '10' },
      { id: '9a', nombre: '9°A', grado: '9' },
    ]);
    agregadosRepository.getResumen = jest.fn(async (_c: string, cursoId: string) => {
      if (cursoId === '9a') throw new Error('permission-denied');
      return resumen(cursoId);
    });
    const r = await loadSchoolReport('col', AHORA, 'yo');
    expect(ids(r)).toEqual(['10b', '9a']);
  });
});
