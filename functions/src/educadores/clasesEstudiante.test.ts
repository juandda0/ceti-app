jest.mock('firebase-functions/v2/https', () => ({
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
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

// eslint-disable-next-line import/first
import { clasesDeClaims, conClase, sinClase } from './clasesEstudiante';

describe('clasesDeClaims', () => {
  it('lee el mapa nuevo y el par de antes', () => {
    expect(clasesDeClaims({ role: 'estudiante', clases: { a: 'x', b: 'y' } })).toEqual({
      a: 'x',
      b: 'y',
    });
    expect(clasesDeClaims({ role: 'estudiante', colegioId: 'x', cursoId: 'a' })).toEqual({
      a: 'x',
    });
    expect(clasesDeClaims({ role: 'profesor', colegioId: 'x' })).toEqual({});
    expect(clasesDeClaims({ role: 'estudiante', clases: { a: 3, '': 'x' } })).toEqual({});
    expect(clasesDeClaims(undefined)).toEqual({});
  });
});

describe('conClase / sinClase', () => {
  it('suma hasta 5 y no repite', () => {
    let c = {};
    for (const k of ['a', 'b', 'c', 'd', 'e']) c = conClase(c, k, 'x');
    expect(Object.keys(c)).toHaveLength(5);
    expect(conClase(c, 'a', 'x')).toBe(c);
    expect(() => conClase(c, 'f', 'x')).toThrow(/5 clases/);
    expect(sinClase(c, 'a')).not.toHaveProperty('a');
  });
});
