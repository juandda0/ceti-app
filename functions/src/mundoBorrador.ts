/**
 * RQ-CN06 — IA de authoring docente (D-ORQ). Pure module: no firebase imports,
 * the model call is injected (ModelCaller) so tests can pass a mock. Generates
 * a DRAFT world (teoría + preguntas de los 3 tipos + elige-camino) that the
 * Function RETURNS — nothing is persisted server-side; the professor reviews
 * and saves from the client. The prompt receives only tema/nombre/grado —
 * never student data (CA2). Same provider plumbing as vozClasificacion.
 */
import { ModelApiError, type ModelCaller } from './vozClasificacion';

export type BorradorTeoriaCard = { titulo: string; cuerpo: string; ejemplo?: string };
export type BorradorMc = {
  enunciado: string;
  opciones: string[];
  correctIndex: number;
  explicacion?: string;
};
export type BorradorVf = { enunciado: string; respuesta: boolean; explicacion?: string };
export type BorradorOrdenar = {
  enunciado: string;
  elementosCorrectos: string[];
  explicacion?: string;
};
export type BorradorEligeCamino = {
  enunciado: string;
  opcionA: { texto: string; consecuencia: string };
  opcionB: { texto: string; consecuencia: string };
};

export type MundoBorrador = {
  nombre: string;
  subtitle: string;
  descripcion: string;
  teoria: BorradorTeoriaCard[];
  mc: BorradorMc[];
  vf: BorradorVf[];
  ordenar: BorradorOrdenar[];
  eligeCamino: BorradorEligeCamino[];
};

// Quiz sampling minimums (R9): the draft must clear them so the world can be
// activated after one IA pass.
const MIN = { teoria: 1, mc: 4, vf: 3, ordenar: 3, eligeCamino: 0 } as const;

export const NOMBRE_MAX = 120;
export const TEMA_MAX = 300;

export const SYSTEM_PROMPT_MUNDO = `Eres un diseñador de contenido de educación financiera para estudiantes colombianos de colegio (13+). Un profesor te da el NOMBRE y el TEMA de un "mundo" (unidad de clase) y el GRADO (9, 10 u 11). Produces exactamente un JSON con el borrador completo del mundo.

Formato de salida (JSON estricto, sin texto adicional):
{
  "nombre": string,                 // el nombre dado por el profesor (puedes pulirlo levemente)
  "subtitle": string,               // subtítulo corto (máx 8 palabras)
  "descripcion": string,            // 1-2 frases sobre qué aprenderá el estudiante
  "teoria": [ { "titulo": string, "cuerpo": string, "ejemplo": string } ],   // 3 a 4 tarjetas
  "mc": [ { "enunciado": string, "opciones": [string,string,string,string], "correctIndex": number, "explicacion": string } ],   // 6 preguntas
  "vf": [ { "enunciado": string, "respuesta": boolean, "explicacion": string } ],   // 5 preguntas
  "ordenar": [ { "enunciado": string, "elementosCorrectos": [string,...], "explicacion": string } ],   // 4 preguntas; 3 a 5 elementos EN SU ORDEN CORRECTO
  "eligeCamino": [ { "enunciado": string, "opcionA": {"texto": string, "consecuencia": string}, "opcionB": {"texto": string, "consecuencia": string} } ]   // 3 situaciones
}

Reglas obligatorias:
1. Lenguaje NEUTRO y claro (no jerga juvenil ni regional), ejemplos cotidianos válidos en Colombia. Nunca teoría densa: tarjetas breves.
2. La dificultad crece con el grado (9 < 10 < 11).
3. PROHIBIDO usar cifras que caducan: salario mínimo, UVT, tasas de interés vigentes, precios exactos. Usa cantidades genéricas ("una parte de tu mesada", "un porcentaje").
4. PROHIBIDO incluir nombres de personas reales, marcas comerciales o datos personales.
5. En "mc", el correctIndex apunta a la opción correcta (0..3) y las opciones incorrectas deben ser plausibles.
6. En "ordenar", elementosCorrectos van EN EL ORDEN CORRECTO (el sistema los desordena después).
7. En "eligeCamino", ninguna opción es "correcta": son decisiones con consecuencias distintas, narradas de forma neutra (sin juzgar al estudiante).
8. Todo el contenido debe ser 100% temático del TEMA dado.`;

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim().slice(0, max) : null;
}

/**
 * Validates/normalizes the raw model output. Invalid items are DROPPED (the
 * professor reviews anyway); throws only when a section falls below the
 * activation minimums — a draft that can't be activated is useless.
 */
export function parseBorradorMundo(raw: unknown): MundoBorrador {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Borrador inválido: no es un objeto.');
  }
  const r = raw as Record<string, unknown>;

  const teoria: BorradorTeoriaCard[] = (Array.isArray(r.teoria) ? r.teoria : [])
    .map((c): BorradorTeoriaCard | null => {
      const card = c as Record<string, unknown>;
      const titulo = str(card.titulo, 80);
      const cuerpo = str(card.cuerpo, 600);
      if (!titulo || !cuerpo) return null;
      const ejemplo = str(card.ejemplo, 400);
      return { titulo, cuerpo, ...(ejemplo ? { ejemplo } : {}) };
    })
    .filter((c): c is BorradorTeoriaCard => c !== null)
    .slice(0, 6);

  const mc: BorradorMc[] = (Array.isArray(r.mc) ? r.mc : [])
    .map((q): BorradorMc | null => {
      const item = q as Record<string, unknown>;
      const enunciado = str(item.enunciado, 400);
      const opciones = Array.isArray(item.opciones)
        ? item.opciones.map((o) => str(o, 160)).filter((o): o is string => o !== null)
        : [];
      const correctIndex = typeof item.correctIndex === 'number' ? item.correctIndex : -1;
      if (
        !enunciado ||
        opciones.length < 3 ||
        correctIndex < 0 ||
        correctIndex >= opciones.length
      ) {
        return null;
      }
      const explicacion = str(item.explicacion, 400);
      return {
        enunciado,
        opciones: opciones.slice(0, 5),
        correctIndex,
        ...(explicacion ? { explicacion } : {}),
      };
    })
    .filter((q): q is BorradorMc => q !== null)
    .slice(0, 10);

  const vf: BorradorVf[] = (Array.isArray(r.vf) ? r.vf : [])
    .map((q): BorradorVf | null => {
      const item = q as Record<string, unknown>;
      const enunciado = str(item.enunciado, 400);
      if (!enunciado || typeof item.respuesta !== 'boolean') return null;
      const explicacion = str(item.explicacion, 400);
      return { enunciado, respuesta: item.respuesta, ...(explicacion ? { explicacion } : {}) };
    })
    .filter((q): q is BorradorVf => q !== null)
    .slice(0, 10);

  const ordenar: BorradorOrdenar[] = (Array.isArray(r.ordenar) ? r.ordenar : [])
    .map((q): BorradorOrdenar | null => {
      const item = q as Record<string, unknown>;
      const enunciado = str(item.enunciado, 400);
      const elementos = Array.isArray(item.elementosCorrectos)
        ? item.elementosCorrectos.map((e) => str(e, 160)).filter((e): e is string => e !== null)
        : [];
      if (!enunciado || elementos.length < 3 || elementos.length > 6) return null;
      const explicacion = str(item.explicacion, 400);
      return { enunciado, elementosCorrectos: elementos, ...(explicacion ? { explicacion } : {}) };
    })
    .filter((q): q is BorradorOrdenar => q !== null)
    .slice(0, 8);

  const eligeCamino: BorradorEligeCamino[] = (Array.isArray(r.eligeCamino) ? r.eligeCamino : [])
    .map((s): BorradorEligeCamino | null => {
      const sit = s as Record<string, unknown>;
      const enunciado = str(sit.enunciado, 400);
      const a = sit.opcionA as Record<string, unknown> | undefined;
      const b = sit.opcionB as Record<string, unknown> | undefined;
      const aTexto = str(a?.texto, 200);
      const aCons = str(a?.consecuencia, 400);
      const bTexto = str(b?.texto, 200);
      const bCons = str(b?.consecuencia, 400);
      if (!enunciado || !aTexto || !aCons || !bTexto || !bCons) return null;
      return {
        enunciado,
        opcionA: { texto: aTexto, consecuencia: aCons },
        opcionB: { texto: bTexto, consecuencia: bCons },
      };
    })
    .filter((s): s is BorradorEligeCamino => s !== null)
    .slice(0, 6);

  if (
    teoria.length < MIN.teoria ||
    mc.length < MIN.mc ||
    vf.length < MIN.vf ||
    ordenar.length < MIN.ordenar
  ) {
    throw new Error(
      `Borrador insuficiente: teoria=${teoria.length} mc=${mc.length} vf=${vf.length} ordenar=${ordenar.length}.`
    );
  }

  return {
    nombre: str(r.nombre, NOMBRE_MAX) ?? '',
    subtitle: str(r.subtitle, 80) ?? '',
    descripcion: str(r.descripcion, 300) ?? '',
    teoria,
    mc,
    vf,
    ordenar,
    eligeCamino,
  };
}

/** Calls the model and returns the validated draft. */
export async function generarBorrador(
  input: { nombre: string; tema: string; grado: string },
  call: ModelCaller
): Promise<MundoBorrador> {
  const userText = `NOMBRE: ${input.nombre}\nTEMA: ${input.tema}\nGRADO: ${input.grado}`;
  const raw = await call(SYSTEM_PROMPT_MUNDO, userText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ModelApiError('El modelo no devolvió JSON válido.');
  }
  return parseBorradorMundo(parsed);
}
