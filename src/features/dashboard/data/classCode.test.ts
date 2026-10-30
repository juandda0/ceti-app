import { codigoDesdeQr, limpiarNombreCompleto, normalizeClassCode } from './classCode';

describe('normalizeClassCode', () => {
  it.each([
    [' abc123 ', 'ABC123'],
    [' ab c12 ', 'AB C12'],
    ['   ', ''],
  ])('normalizes %p', (rawCode, expected) => {
    expect(normalizeClassCode(rawCode)).toBe(expected);
  });
});

describe('codigoDesdeQr', () => {
  it('saca el código del enlace de invitación o lo toma solo', () => {
    expect(codigoDesdeQr('https://ceti-d3769.web.app/join/abc234')).toBe('ABC234');
    expect(codigoDesdeQr('ceti://join/MATE2B?x=1')).toBe('MATE2B');
    expect(codigoDesdeQr('  mate9a ')).toBe('MATE9A');
  });

  it('rechaza lo que no es un código de Ceti', () => {
    expect(codigoDesdeQr('https://otra.app/inicio')).toBeNull();
    expect(codigoDesdeQr('hola mundo')).toBeNull();
    expect(codigoDesdeQr('')).toBeNull();
  });
});

describe('limpiarNombreCompleto', () => {
  it('pide nombre y apellido y quita espacios de sobra', () => {
    expect(limpiarNombreCompleto('  Valentina   Ríos ')).toBe('Valentina Ríos');
    expect(limpiarNombreCompleto('Valentina')).toBeNull();
    expect(limpiarNombreCompleto('A B')).toBeNull();
    expect(limpiarNombreCompleto('x'.repeat(50) + ' ' + 'y'.repeat(40))).toBeNull();
  });
});
