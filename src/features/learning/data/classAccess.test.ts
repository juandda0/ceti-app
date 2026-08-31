import { hasClassAccess } from './classAccess';

describe('hasClassAccess', () => {
  it.each([
    ['colegio_1', 'curso_1', true],
    [null, 'curso_1', false],
    ['colegio_1', null, false],
    [' ', 'curso_1', false],
    ['colegio_1', ' ', false],
    ['colegio_1', undefined, false],
  ])('returns %s for a complete class identity', (colegioId, cursoId, expected) => {
    expect(hasClassAccess(colegioId, cursoId)).toBe(expected);
  });
});
