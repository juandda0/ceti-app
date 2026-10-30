import { limpiarTextoMuro, muroParaEstudiante, nombreEnMuro, puedePreguntar } from './muroClase';

const ahora = 1_800_000_000_000;
describe('muro de preguntas (F9)', () => {
  it('limpia el texto', () => {
    expect(limpiarTextoMuro('  ¿Qué   es\n\n\n\nun CDT? ', 280)).toEqual({ ok: true, texto: '¿Qué es\n\nun CDT?' });
    expect(limpiarTextoMuro('   ', 280)).toEqual({ ok: false, error: 'vacia' });
    expect(limpiarTextoMuro('x'.repeat(281), 280)).toEqual({ ok: false, error: 'larga' });
  });
  it('solo el primer nombre', () => {
    expect(nombreEnMuro('Mariana López Ruiz')).toBe('Mariana');
    expect(nombreEnMuro('')).toBe('Estudiante');
  });
  it('límites de pendientes y por día', () => {
    const p = (estado: 'pendiente' | 'publicada', hace: number) => ({ estado, creadoAt: ahora - hace });
    expect(puedePreguntar([p('pendiente', 1), p('pendiente', 2)], ahora)).toBeNull();
    expect(puedePreguntar([p('pendiente', 1), p('pendiente', 2), p('pendiente', 3)], ahora)).toBe('pendientes');
    expect(puedePreguntar(Array.from({ length: 10 }, (_, i) => p('publicada', i)), ahora)).toBe('dia');
    expect(puedePreguntar(Array.from({ length: 10 }, () => p('publicada', 2 * 86_400_000)), ahora)).toBeNull();
  });
  it('el estudiante ve las publicadas y las suyas', () => {
    const lista = [
      { id: 'a', uid: 'yo', estado: 'pendiente' as const, creadoAt: 3 },
      { id: 'b', uid: 'otro', estado: 'pendiente' as const, creadoAt: 4 },
      { id: 'c', uid: 'otro', estado: 'publicada' as const, creadoAt: 1 },
      { id: 'd', uid: 'yo', estado: 'oculta' as const, creadoAt: 5 },
    ];
    expect(muroParaEstudiante(lista, 'yo').map((p) => p.id)).toEqual(['a', 'c']);
  });
});
