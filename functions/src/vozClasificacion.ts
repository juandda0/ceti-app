/**
 * RQ-ES10 — Voice-diary text classification (the ONLY runtime AI in Ceti,
 * excepción D-ES10-01). Pure module: no firebase imports, the Anthropic client
 * is injected so tests can pass a mock. The model only ever sees the transcript
 * TEXT (audio never reaches our servers) and is instructed to drop PII.
 */

export const MOVIMIENTO_CATEGORIAS = [
  'comida',
  'transporte',
  'entretenimiento',
  'ropa',
  'educacion',
  'tecnologia',
  'regalos',
  'otros',
] as const;

export type MovimientoCategoria = (typeof MOVIMIENTO_CATEGORIAS)[number];

export type ClasificacionMovimiento = {
  tipo: 'ahorro' | 'gasto';
  monto: number;
  descripcion: string;
  categoria: MovimientoCategoria;
  confianza: number;
};

export const MONTO_MAX = 100_000_000;
export const DESCRIPCION_MAX = 140;

export const SYSTEM_PROMPT = `Eres un clasificador de registros de dinero de bolsillo de estudiantes colombianos (13+). Recibes la transcripción de una frase dicha por voz y produces exactamente un JSON con la clasificación.

Reglas:
1. "tipo": "ahorro" si el estudiante guardó/recibió/apartó dinero; "gasto" si lo gastó/compró/pagó.
2. "monto": entero en pesos colombianos, >= 0. Convierte palabras a números: "cinco mil" -> 5000, "veinte mil" -> 20000, "dos mil quinientos" -> 2500. Jerga colombiana: "una luca" -> 1000, "cinco lucas" -> 5000, "veinte lucas" -> 20000. Montos ambiguos como "a doce" se interpretan en miles (12000) con confianza reducida. Si no hay monto identificable, usa 0 y baja la confianza.
3. "descripcion": máximo 10 palabras, reformulada de forma neutra. OMITE SIEMPRE nombres propios de personas, apodos, lugares específicos identificables y cualquier dato personal ("le compré un regalo a Valentina Gómez" -> "regalo para una amiga").
4. "categoria": exactamente una de: comida, transporte, entretenimiento, ropa, educacion, tecnologia, regalos, otros. Ante duda, "otros". Para ahorros sin destino claro, "otros".
5. "confianza": 0 a 1. Usa < 0.5 si la frase es ruido, no menciona dinero, es incoherente o falta el monto.
6. Nunca inventes datos que no estén en la frase.

Ejemplos:
- "gasté cinco mil en un helado" -> {"tipo":"gasto","monto":5000,"descripcion":"helado","categoria":"comida","confianza":0.97}
- "ahorré veinte mil de mi mesada" -> {"tipo":"ahorro","monto":20000,"descripcion":"ahorro de mesada","categoria":"otros","confianza":0.95}
- "me gasté quince lucas en el bus y el metro esta semana" -> {"tipo":"gasto","monto":15000,"descripcion":"transporte de la semana","categoria":"transporte","confianza":0.9}
- "le di diez mil a mi hermano Juan por su cumpleaños" -> {"tipo":"gasto","monto":10000,"descripcion":"regalo de cumpleaños","categoria":"regalos","confianza":0.9}
- "eh mmm no sé qué decir hola hola" -> {"tipo":"gasto","monto":0,"descripcion":"registro no claro","categoria":"otros","confianza":0.1}`;

// Structured-outputs schema. Numeric/length bounds are NOT supported by the
// API's json_schema format, so parseClasificacion() enforces them server-side.
export const MOVIMIENTO_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tipo', 'monto', 'descripcion', 'categoria', 'confianza'],
  properties: {
    tipo: { type: 'string', enum: ['ahorro', 'gasto'] },
    monto: { type: 'integer' },
    descripcion: { type: 'string' },
    categoria: { type: 'string', enum: [...MOVIMIENTO_CATEGORIAS] },
    confianza: { type: 'number' },
  },
} as const;

/** Minimal surface of the Anthropic SDK client — injected so tests mock it. */
export interface AnthropicLike {
  messages: {
    // any: la firma real del SDK tipa params de forma más estricta; por
    // contravarianza, cualquier tipo concreto aquí impediría inyectar el
    // cliente real. Solo esta función construye los params.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create(params: any): Promise<{
      content: Array<{ type: string; text?: string }>;
    }>;
  };
}

/**
 * Validates/normalizes the raw model output. Throws on unrecoverable shapes;
 * normalizes recoverable ones (unknown category -> 'otros' with penalized
 * confidence, confidence clamp, description truncation).
 */
export function parseClasificacion(raw: unknown): ClasificacionMovimiento {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Clasificación inválida: no es un objeto.');
  }
  const r = raw as Record<string, unknown>;

  if (r.tipo !== 'ahorro' && r.tipo !== 'gasto') {
    throw new Error(`Clasificación inválida: tipo '${String(r.tipo)}'.`);
  }
  if (
    typeof r.monto !== 'number' ||
    !Number.isInteger(r.monto) ||
    r.monto < 0 ||
    r.monto > MONTO_MAX
  ) {
    throw new Error(`Clasificación inválida: monto '${String(r.monto)}'.`);
  }
  if (typeof r.descripcion !== 'string' || typeof r.confianza !== 'number') {
    throw new Error('Clasificación inválida: descripcion/confianza.');
  }

  let confianza = Math.min(1, Math.max(0, r.confianza));
  let categoria: MovimientoCategoria;
  if ((MOVIMIENTO_CATEGORIAS as readonly string[]).includes(String(r.categoria))) {
    categoria = r.categoria as MovimientoCategoria;
  } else {
    // ponytail: unknown category degrades to 'otros' instead of failing the call
    categoria = 'otros';
    confianza = Math.min(confianza, 0.5);
  }

  return {
    tipo: r.tipo,
    monto: r.monto,
    descripcion: r.descripcion.trim().slice(0, DESCRIPCION_MAX),
    categoria,
    confianza,
  };
}

/** Calls the model with structured output and returns the validated classification. */
export async function clasificarTexto(
  texto: string,
  client: AnthropicLike
): Promise<ClasificacionMovimiento> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: MOVIMIENTO_OUTPUT_SCHEMA } },
    messages: [{ role: 'user', content: texto }],
  });

  const block = response.content.find((b) => b.type === 'text');
  if (!block?.text) {
    throw new Error('El modelo no devolvió texto.');
  }
  return parseClasificacion(JSON.parse(block.text));
}
