import {
  armarInsignia,
  codigoCertificado,
  desempenosTrabajados,
  esCodigoCertificado,
  esInsignia,
  faltantes,
  normasDelCertificado,
  publicoDe,
  textoNormas,
  type CertificadoGuardado,
} from './certificados';

describe('certificados', () => {
  it('el código tiene la forma CETI-XXXX-XXXX sin letras confusas', () => {
    const c = codigoCertificado([0, 1, 2, 3, 200, 255, 31, 64]);
    expect(esCodigoCertificado(c)).toBe(true);
    expect(c).toMatch(/^CETI-/);
    expect(esCodigoCertificado('CETI-AAAA-BBB0')).toBe(false);
    expect(esCodigoCertificado('ceti-aaaa-bbbb')).toBe(false);
  });

  it('dice qué mundos le faltan y cuenta desempeños trabajados', () => {
    expect(faltantes(new Set(['world_1', 'world_2']), ['world_1', 'world_3'])).toEqual(['world_3']);
    expect(faltantes(['world_1'], ['world_1'])).toEqual([]);
    expect(desempenosTrabajados({ a: { respuestas: 2 }, b: { respuestas: 0 }, c: {} })).toBe(1);
    expect(desempenosTrabajados(null)).toBe(0);
  });

  it('cita las normas vigentes, sin el 457, y en universidad sin las de la básica', () => {
    const colegio = normasDelCertificado('colegio').map((n) => n.id);
    expect(colegio).toContain('decreto1517');
    expect(colegio).toContain('conpes4005');
    expect(colegio).not.toContain('decreto457');
    expect(colegio).toContain('ley1450');
    const u = normasDelCertificado('universidad').map((n) => n.id);
    expect(u).not.toContain('ley1450');
    expect(u).not.toContain('doc26');
    expect(textoNormas('universidad')).toContain('Decreto 1517 de 2021');
  });

  it('lo público no lleva ids ni quién lo emitió', () => {
    const g: CertificadoGuardado = {
      codigo: 'CETI-AAAA-BBBB', nombre: 'Mariana López', clase: '10°B', institucion: 'San Mateo', tipoEntidad: 'colegio',
      mundos: ['Ahorro'], desempenos: 3, desde: 1, hasta: 2, profe: 'Andrés', emitidoAt: 2, revocadoAt: null,
      colegioId: 'c', cursoId: 'k', uid: 'u', emitidoPor: 'p',
    };
    const p = publicoDe(g);
    expect(p).not.toHaveProperty('uid');
    expect(p).not.toHaveProperty('colegioId');
    expect(p).not.toHaveProperty('emitidoPor');
    expect(p.nombre).toBe('Mariana López');
  });
});

describe('insignias', () => {
  it('solo las del catálogo, con motivo corto o sin motivo', () => {
    expect(esInsignia('constancia')).toBe(true);
    expect(esInsignia('mejor')).toBe(false);
    const i = armarInsignia('constancia', '  entró   todos los días ', { uid: 'p', nombre: 'Andrés' }, 5);
    expect(i).toEqual({ insignia: 'constancia', motivo: 'entró todos los días', dadaPor: 'p', dadaPorNombre: 'Andrés', dadaAt: 5 });
    expect(armarInsignia('gran_avance', '   ', { uid: 'p', nombre: 'A' }, 1).motivo).toBeNull();
    expect(armarInsignia('gran_avance', 'x'.repeat(300), { uid: 'p', nombre: 'A' }, 1).motivo).toHaveLength(120);
  });
});
