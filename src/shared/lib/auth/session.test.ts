import { toCetiClaims } from '@shared/lib/auth/session';

jest.mock('@shared/lib/api/client', () => ({}));
jest.mock('@shared/lib/auth/tokenStore', () => ({}));

describe('toCetiClaims', () => {
  it('admin es global: no necesita colegio', () => {
    expect(toCetiClaims({ role: 'admin', colegioId: null, cursoId: null })).toEqual({
      role: 'admin',
      colegioId: undefined,
      cursoId: undefined,
    });
  });

  it('estudiante con clase conserva su tenant', () => {
    expect(toCetiClaims({ role: 'estudiante', colegioId: 'c', cursoId: 'k' })).toEqual({
      role: 'estudiante',
      colegioId: 'c',
      cursoId: 'k',
    });
  });

  it('invitado (estudiante sin colegio) y sin rol cuentan como sin claims', () => {
    expect(toCetiClaims({ role: 'estudiante', colegioId: null, cursoId: null })).toBeNull();
    expect(toCetiClaims({ role: null, colegioId: null, cursoId: null })).toBeNull();
  });
});
