import {
  codigoLimite,
  esMotivo,
  fechaLarga,
  formatoNumeroSoporte,
  mesBogota,
  motivoDeError,
  numeroSoporte,
  planParaMotivo,
  SOPORTE_MARCADOR,
  urlWhatsApp,
} from './planUi';

describe('motivos del muro', () => {
  it('reconoce funciones y motivos de límite', () => {
    expect(esMotivo('clases')).toBe(true);
    expect(esMotivo('iaAuthoring')).toBe(true);
    expect(esMotivo('estudiantes')).toBe(true);
    expect(esMotivo('borrarTodo')).toBe(false);
    expect(esMotivo(undefined)).toBe(false);
  });

  it('elige el plan que resuelve el motivo', () => {
    expect(planParaMotivo('clases', 'cadete')).toBe('piloto');
    expect(planParaMotivo('editarContenido', 'cadete')).toBe('piloto');
    expect(planParaMotivo('aulasConMarca', 'cadete')).toBe('comandante');
    expect(planParaMotivo('panelCapitan', 'piloto')).toBe('nave');
    // Más IA: desde Cadete basta Piloto; con el cupo de Piloto agotado, Comandante.
    expect(planParaMotivo('ia', 'cadete')).toBe('piloto');
    expect(planParaMotivo('ia', 'piloto')).toBe('comandante');
    expect(planParaMotivo('estudiantes', 'cadete')).toBe('piloto');
    expect(planParaMotivo('estudiantes', 'piloto')).toBe('nave');
  });
});

describe('errores de límite del servidor', () => {
  const error = (details: unknown) => Object.assign(new Error('x'), { details });

  it('lee details.codigo de un HttpsError', () => {
    expect(codigoLimite(error({ codigo: 'limite_clases' }))).toBe('limite_clases');
    expect(codigoLimite(error({ codigo: 'otro' }))).toBeNull();
    expect(codigoLimite(error(undefined))).toBeNull();
    expect(codigoLimite(new Error('red'))).toBeNull();
    expect(codigoLimite(null)).toBeNull();
  });

  it('traduce el código al motivo del muro', () => {
    expect(motivoDeError(error({ codigo: 'limite_clases' }))).toBe('clases');
    expect(motivoDeError(error({ codigo: 'limite_estudiantes' }))).toBe('estudiantes');
    expect(motivoDeError(error({ codigo: 'limite_ia' }))).toBe('ia');
    expect(motivoDeError(error({ codigo: 'requiere_plan' }))).toBe('iaAuthoring');
    expect(motivoDeError(error({ codigo: 'requiere_plan' }), 'mundosPropios')).toBe(
      'mundosPropios'
    );
    expect(motivoDeError(error({ codigo: 'requiere_plan', funcion: 'configurarMundos' }))).toBe(
      'configurarMundos'
    );
    expect(motivoDeError(new Error('otro'))).toBeNull();
  });
});

describe('fechas en hora de Bogotá', () => {
  it('mes de uso en Bogotá (UTC-5)', () => {
    // 1 de noviembre 03:00 UTC = 31 de octubre 22:00 en Bogotá.
    expect(mesBogota(Date.UTC(2026, 10, 1, 3))).toBe('2026-10');
    expect(mesBogota(Date.UTC(2026, 10, 1, 6))).toBe('2026-11');
  });

  it('fecha larga con año solo si no es el actual', () => {
    const ahora = Date.UTC(2026, 9, 22, 15);
    expect(fechaLarga(Date.UTC(2026, 10, 1, 15), ahora)).toMatch(/1 de noviembre/);
    expect(fechaLarga(Date.UTC(2027, 1, 1, 15), ahora)).toMatch(/2027/);
  });
});

describe('WhatsApp de soporte', () => {
  it('usa el marcador si no hay número configurado', () => {
    expect(numeroSoporte(undefined)).toBe(SOPORTE_MARCADOR);
    expect(numeroSoporte('123')).toBe(SOPORTE_MARCADOR);
    expect(numeroSoporte('+57 300 123 4567')).toBe('573001234567');
  });

  it('formatea y arma el enlace wa.me', () => {
    expect(formatoNumeroSoporte('573001234567')).toBe('+57 300 123 4567');
    expect(formatoNumeroSoporte('15551234567')).toBe('+15551234567');
    expect(urlWhatsApp('573001234567')).toBe('https://wa.me/573001234567');
    expect(urlWhatsApp('573001234567', 'Hola, Ceti')).toBe(
      'https://wa.me/573001234567?text=Hola%2C%20Ceti'
    );
  });
});
