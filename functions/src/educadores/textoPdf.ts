/**
 * Texto de un PDF que sube el profe para crear un mundo con IA (Fase 4). Se
 * extrae en el servidor y vuelve al cliente para que el profe lo revise antes
 * de generar. Nada se guarda.
 */
import { HttpsError } from 'firebase-functions/v2/https';
import { FUENTE_MAX } from '../mundoBorrador';

/** ~4 MB de PDF (en base64 son ~5,5 MB). */
export const MAX_PDF_BYTES = 4 * 1024 * 1024;

/** Espacios y saltos de línea razonables; recorta al largo que acepta la IA. */
export function limpiarTextoPdf(texto: string): { texto: string; recortado: boolean } {
  const limpio = texto
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { texto: limpio.slice(0, FUENTE_MAX), recortado: limpio.length > FUENTE_MAX };
}

export function bytesDePdf(base64: unknown): Buffer {
  if (typeof base64 !== 'string' || base64.length === 0) {
    throw new HttpsError('invalid-argument', 'Falta el archivo.');
  }
  const datos = Buffer.from(base64.replace(/^data:[^,]*,/, ''), 'base64');
  if (datos.length > MAX_PDF_BYTES) {
    throw new HttpsError('invalid-argument', 'El PDF pesa más de 4 MB.', { codigo: 'pdf_grande' });
  }
  if (datos.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new HttpsError('invalid-argument', 'El archivo no es un PDF.', { codigo: 'no_pdf' });
  }
  return datos;
}

export type LectorPdf = (datos: Uint8Array) => Promise<{ text: string; totalPages: number }>;

/**
 * unpdf (pdf.js para servidores) es un módulo ESM y las Functions compilan a
 * CommonJS: se carga con un import() nativo que TypeScript no reescribe.
 */
const importarEsm = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;

export const leerConUnpdf: LectorPdf = async (datos) => {
  const { extractText, getDocumentProxy } = (await importarEsm('unpdf')) as typeof import('unpdf');
  const pdf = await getDocumentProxy(datos);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text: Array.isArray(text) ? text.join('\n') : text, totalPages };
};

export async function extraerTexto(
  datos: Buffer,
  leer: LectorPdf = leerConUnpdf
): Promise<{ texto: string; paginas: number; recortado: boolean }> {
  let leido;
  try {
    leido = await leer(new Uint8Array(datos));
  } catch {
    throw new HttpsError('invalid-argument', 'No se pudo leer el PDF.', { codigo: 'pdf_ilegible' });
  }
  const { texto, recortado } = limpiarTextoPdf(leido.text ?? '');
  if (!texto) {
    throw new HttpsError(
      'failed-precondition',
      'El PDF no tiene texto (¿es una imagen escaneada?).',
      {
        codigo: 'pdf_sin_texto',
      }
    );
  }
  return { texto, paginas: leido.totalPages ?? 0, recortado };
}
