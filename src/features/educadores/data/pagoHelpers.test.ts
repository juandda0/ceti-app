import {
  cvcValido,
  erroresTarjeta,
  esCelularValido,
  formatoCelular,
  formatoNumeroTarjeta,
  formatoVencimiento,
  leerVencimiento,
  marcaTarjeta,
  normalizarCelular,
  numeroTarjetaValido,
  pasaLuhn,
  soloDigitos,
  titularValido,
  ultimosCuatro,
  vencimientoValido,
} from './pagoHelpers';

// 15 de junio de 2026, mediodía UTC.
const AHORA = Date.UTC(2026, 5, 15, 12);

describe('celular Nequi', () => {
  it('normaliza +57, 57, espacios y guiones', () => {
    expect(normalizarCelular('+57 300 123 4567')).toBe('3001234567');
    expect(normalizarCelular('573001234567')).toBe('3001234567');
    expect(normalizarCelular('300-123-4567')).toBe('3001234567');
    expect(normalizarCelular(' 300 123 4567 ')).toBe('3001234567');
  });

  it('corta a 10 dígitos', () => {
    expect(normalizarCelular('30012345678')).toBe('3001234567');
  });

  it('valida que empiece por 3 y tenga 10 dígitos', () => {
    expect(esCelularValido('300 123 4567')).toBe(true);
    expect(esCelularValido('+57 315 000 0000')).toBe(true);
    expect(esCelularValido('2001234567')).toBe(false);
    expect(esCelularValido('300123456')).toBe(false);
    expect(esCelularValido('')).toBe(false);
  });

  it('formatea mientras escribe', () => {
    expect(formatoCelular('3')).toBe('3');
    expect(formatoCelular('3001')).toBe('300 1');
    expect(formatoCelular('3001234')).toBe('300 123 4');
    expect(formatoCelular('+573001234567')).toBe('300 123 4567');
  });
});

describe('tarjeta: Luhn y marca', () => {
  it('acepta números de prueba válidos', () => {
    expect(pasaLuhn('4242424242424242')).toBe(true);
    expect(pasaLuhn('4111 1111 1111 1111')).toBe(true);
    expect(pasaLuhn('5555555555554444')).toBe(true);
    expect(pasaLuhn('378282246310005')).toBe(true);
  });

  it('rechaza un número que no cumple el dígito de control', () => {
    expect(pasaLuhn('4242424242424241')).toBe(false);
    expect(pasaLuhn('')).toBe(false);
  });

  it('detecta la marca', () => {
    expect(marcaTarjeta('4242424242424242')).toBe('visa');
    expect(marcaTarjeta('5555555555554444')).toBe('mastercard');
    expect(marcaTarjeta('2223003122003222')).toBe('mastercard');
    expect(marcaTarjeta('378282246310005')).toBe('amex');
    expect(marcaTarjeta('30569309025904')).toBe('diners');
    expect(marcaTarjeta('6011111111111117')).toBe('otra');
  });

  it('valida largo + Luhn según la marca', () => {
    expect(numeroTarjetaValido('4242 4242 4242 4242')).toBe(true);
    expect(numeroTarjetaValido('378282246310005')).toBe(true);
    expect(numeroTarjetaValido('424242424242')).toBe(false);
    expect(numeroTarjetaValido('4242424242424241')).toBe(false);
  });
});

describe('formatoNumeroTarjeta', () => {
  it('agrupa 4-4-4-4', () => {
    expect(formatoNumeroTarjeta('4242')).toBe('4242');
    expect(formatoNumeroTarjeta('42424')).toBe('4242 4');
    expect(formatoNumeroTarjeta('4242424242424242')).toBe('4242 4242 4242 4242');
  });

  it('agrupa Amex 4-6-5 y corta en 15', () => {
    expect(formatoNumeroTarjeta('3782822463')).toBe('3782 822463');
    expect(formatoNumeroTarjeta('378282246310005')).toBe('3782 822463 10005');
    expect(formatoNumeroTarjeta('3782822463100059')).toBe('3782 822463 10005');
  });

  it('corta Mastercard en 16 y limpia lo que no es dígito', () => {
    expect(formatoNumeroTarjeta('5555-5555-5555-4444-99')).toBe('5555 5555 5555 4444');
  });
});

describe('vencimiento', () => {
  it('formatea mientras escribe', () => {
    expect(formatoVencimiento('1')).toBe('1');
    expect(formatoVencimiento('5')).toBe('05');
    expect(formatoVencimiento('12')).toBe('12');
    expect(formatoVencimiento('122')).toBe('12/2');
    expect(formatoVencimiento('1228')).toBe('12/28');
    expect(formatoVencimiento('12/289')).toBe('12/28');
  });

  it('lee MM/AA', () => {
    expect(leerVencimiento('08/28')).toEqual({ mes: '08', anio: '28' });
    expect(leerVencimiento('13/28')).toBeNull();
    expect(leerVencimiento('00/28')).toBeNull();
    expect(leerVencimiento('8/28')).toBeNull();
  });

  it('vale hasta el último día del mes impreso', () => {
    expect(vencimientoValido('06/26', AHORA)).toBe(true);
    expect(vencimientoValido('05/26', AHORA)).toBe(false);
    expect(vencimientoValido('12/30', AHORA)).toBe(true);
    // Más de 20 años hacia adelante no es real.
    expect(vencimientoValido('12/49', AHORA)).toBe(false);
    expect(vencimientoValido('1/30', AHORA)).toBe(false);
  });

  it('el último instante del mes todavía vale y el primero del siguiente no', () => {
    const finJunio = Date.UTC(2026, 6, 1) - 1;
    expect(vencimientoValido('06/26', finJunio)).toBe(true);
    expect(vencimientoValido('06/26', Date.UTC(2026, 6, 1))).toBe(false);
  });
});

describe('cvc y titular', () => {
  it('Amex pide 4 dígitos; las demás 3 o 4', () => {
    expect(cvcValido('1234', 'amex')).toBe(true);
    expect(cvcValido('123', 'amex')).toBe(false);
    expect(cvcValido('123', 'visa')).toBe(true);
    expect(cvcValido('1234', 'visa')).toBe(true);
    expect(cvcValido('12', 'visa')).toBe(false);
    expect(cvcValido('12a', 'visa')).toBe(false);
  });

  it('acepta nombres con tildes y rechaza números o muy cortos', () => {
    expect(titularValido('María José Peña')).toBe(true);
    expect(titularValido("D'Angelo O. Ruiz-Díaz")).toBe(true);
    expect(titularValido('  Ana  ')).toBe(true);
    expect(titularValido('Jo')).toBe(false);
    expect(titularValido('Juan 123')).toBe(false);
    expect(titularValido('-Juan')).toBe(false);
    expect(titularValido('a'.repeat(61))).toBe(false);
  });
});

describe('erroresTarjeta', () => {
  const buena = {
    numero: '4242 4242 4242 4242',
    vence: '12/30',
    cvc: '123',
    titular: 'Ana Pérez',
  };

  it('vacío cuando todo está bien', () => {
    expect(erroresTarjeta(buena, AHORA)).toEqual([]);
  });

  it('lista cada campo con error', () => {
    expect(erroresTarjeta({ numero: '', vence: '', cvc: '', titular: '' }, AHORA)).toEqual([
      'numero',
      'vence',
      'cvc',
      'titular',
    ]);
    expect(erroresTarjeta({ ...buena, vence: '01/26' }, AHORA)).toEqual(['vence']);
  });

  it('el CVC depende de la marca', () => {
    expect(erroresTarjeta({ ...buena, numero: '378282246310005' }, AHORA)).toEqual(['cvc']);
    expect(erroresTarjeta({ ...buena, numero: '378282246310005', cvc: '1234' }, AHORA)).toEqual([]);
  });
});

describe('utilidades', () => {
  it('soloDigitos y ultimosCuatro', () => {
    expect(soloDigitos('4242 4242-42a')).toBe('4242424242');
    expect(ultimosCuatro('4242 4242 4242 4242')).toBe('4242');
    expect(ultimosCuatro('378282246310005')).toBe('0005');
  });
});
