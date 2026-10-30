jest.mock('firebase-functions/v2/https', () => ({
  HttpsError: class HttpsError extends Error {
    details: unknown;
    constructor(_c: string, m: string, d?: unknown) {
      super(m);
      this.details = d;
    }
  },
}));

import { readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line import/first
import { bytesDePdf, extraerTexto, limpiarTextoPdf } from './textoPdf';
// eslint-disable-next-line import/first
import { FUENTE_MAX } from '../mundoBorrador';

describe('texto de un PDF', () => {
  it('limpia espacios y recorta al largo de la IA', () => {
    expect(limpiarTextoPdf('  Hola   mundo \r\n\n\n\nAdios ')).toEqual({
      texto: 'Hola mundo\n\nAdios',
      recortado: false,
    });
    const largo = limpiarTextoPdf('a'.repeat(FUENTE_MAX + 10));
    expect(largo.texto).toHaveLength(FUENTE_MAX);
    expect(largo.recortado).toBe(true);
  });

  it('acepta un PDF (también con encabezado data:) y rechaza lo que no lo es', () => {
    const pdf = readFileSync(join(__dirname, '__fixtures__', 'material.pdf'));
    expect(bytesDePdf(`data:application/pdf;base64,${pdf.toString('base64')}`).length).toBe(
      pdf.length
    );
    expect(() => bytesDePdf(Buffer.from('hola').toString('base64'))).toThrow(/no es un PDF/);
    expect(() => bytesDePdf('')).toThrow(/Falta/);
  });

  it('devuelve el texto limpio y avisa si el PDF no tiene texto', async () => {
    const pdf = Buffer.from('%PDF-1.4');
    const r = await extraerTexto(pdf, async () => ({ text: 'Hola   mundo', totalPages: 2 }));
    expect(r).toEqual({ texto: 'Hola mundo', paginas: 2, recortado: false });
    await expect(
      extraerTexto(pdf, async () => ({ text: '  ', totalPages: 1 }))
    ).rejects.toMatchObject({
      details: { codigo: 'pdf_sin_texto' },
    });
    await expect(
      extraerTexto(pdf, async () => {
        throw new Error('roto');
      })
    ).rejects.toMatchObject({ details: { codigo: 'pdf_ilegible' } });
  });
});
