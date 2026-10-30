import { certificadoHtml, lista } from './certificadoHtml';

const base = {
  codigo: 'CETI-7K4M-Q2XP',
  nombre: 'Mariana <López>',
  clase: '10°B',
  institucion: 'Colegio San Mateo',
  tipoEntidad: 'colegio',
  mundos: ['Presupuesto', 'Ahorro', 'Crédito'],
  desempenos: 12,
  desde: Date.UTC(2026, 1, 3, 15),
  hasta: Date.UTC(2026, 9, 28, 15),
  profe: 'Andrés Rojas',
  emitidoAt: Date.UTC(2026, 9, 30, 15),
  revocadoAt: null,
};

describe('certificadoHtml', () => {
  it('nombra al estudiante, la clase, los mundos y cita el Decreto 1517 sin el 457', () => {
    const h = certificadoHtml(base, 'ceti.app/certificado/CETI-7K4M-Q2XP');
    expect(h).toContain('Mariana &lt;López&gt;');
    expect(h).toContain('Presupuesto, Ahorro y Crédito');
    expect(h).toContain('Decreto 1517 de 2021');
    expect(h).toContain('CONPES 4005');
    expect(h).not.toContain('457');
    expect(h).toContain('no es una entidad certificadora');
    expect(h).not.toMatch(/obligatori|multa|sanci/i);
    expect(h).toContain('CETI-7K4M-Q2XP');
  });

  it('en universidad no cita la Ley 1450 ni el Documento 26, y avisa si fue revocado', () => {
    const h = certificadoHtml({ ...base, tipoEntidad: 'universidad', revocadoAt: base.emitidoAt }, 'x');
    expect(h).not.toContain('Ley 1450');
    expect(h).not.toContain('Documento 26');
    expect(h).toContain('fue revocado');
  });

  it('lista con «y»', () => {
    expect(lista(['a'])).toBe('a');
    expect(lista(['a', 'b'])).toBe('a y b');
  });
});
