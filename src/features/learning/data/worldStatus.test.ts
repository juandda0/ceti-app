import { worldStatus } from '@features/learning/data/worldStatus';
import { MASTERY_THRESHOLD } from '@features/learning/data/mastery';

describe('worldStatus', () => {
  it('bloqueado cuando no está desbloqueado (sin importar el ratio)', () => {
    expect(worldStatus(false, 1)).toBe('bloqueado');
  });
  it('disponible cuando está desbloqueado sin progreso', () => {
    expect(worldStatus(true, 0)).toBe('disponible');
  });
  it('en_progreso con algún acierto por debajo del umbral', () => {
    expect(worldStatus(true, MASTERY_THRESHOLD - 0.1)).toBe('en_progreso');
  });
  it('en_progreso justo por debajo del umbral', () => {
    expect(worldStatus(true, MASTERY_THRESHOLD - 0.01)).toBe('en_progreso');
  });
  it('dominado al alcanzar el umbral de maestría (no requiere 100%)', () => {
    expect(worldStatus(true, MASTERY_THRESHOLD)).toBe('dominado');
  });
  it('dominado al 100%', () => {
    expect(worldStatus(true, 1)).toBe('dominado');
  });
});
