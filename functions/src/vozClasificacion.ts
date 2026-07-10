/**
 * RQ-ES10 — Voice-diary text classification (the ONLY runtime AI in Ceti,
 * excepción D-ES10-01). Pure module: no firebase imports, the model call is
 * injected (ModelCaller) so tests can pass a mock. The model only ever sees the
 * transcript TEXT (audio never reaches our servers) and is instructed to drop PII.
 * Provider: Groq (Llama, JSON mode). The provider is an implementation detail —
 * the R7 exception is "server-side classification for RQ-ES10", not a specific vendor.
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

// Intención detectada por palabra clave: registrar un gasto/ahorro (por
// defecto), abonar a una meta existente ("abonar"), o crear una meta nueva
// ("nueva meta"). Para las intenciones de meta, `descripcion` = nombre de la
// meta y `monto` = abono (abonar) u objetivo (crear).
export const MOVIMIENTO_INTENCIONES = ['movimiento', 'abonar_meta', 'crear_meta'] as const;

export type MovimientoIntencion = (typeof MOVIMIENTO_INTENCIONES)[number];

export type ClasificacionMovimiento = {
  intencion: MovimientoIntencion;
  tipo: 'ahorro' | 'gasto';
  monto: number;
  descripcion: string;
  categoria: MovimientoCategoria;
  confianza: number;
};

export const MONTO_MAX = 100_000_000;
export const DESCRIPCION_MAX = 140;

export const SYSTEM_PROMPT = `Eres un clasificador de registros de dinero de bolsillo de estudiantes colombianos (13+). Recibes la transcripción de una frase dicha por voz y produces exactamente un JSON con la clasificación.

Primero detecta la INTENCIÓN por palabra clave:
- Si la frase contiene "nueva meta" o "crear meta" -> "intencion":"crear_meta". El estudiante quiere crear una meta de ahorro: "descripcion" = nombre de la meta (máx 4 palabras), "monto" = objetivo (cuánto quiere juntar), "tipo":"ahorro", "categoria":"otros".
- Si la frase contiene "abonar", "aportar a mi meta" o "sumar a mi meta" -> "intencion":"abonar_meta". El estudiante quiere sumar dinero a una meta que YA tiene: "descripcion" = nombre de la meta a la que abona (máx 4 palabras), "monto" = cuánto abona, "tipo":"ahorro", "categoria":"otros".
- En cualquier otro caso -> "intencion":"movimiento" (un gasto o ahorro normal).

Reglas de los demás campos:
1. "tipo": "ahorro" si el estudiante guardó/recibió/apartó dinero; "gasto" si lo gastó/compró/pagó. Para crear_meta y abonar_meta usa siempre "ahorro".
2. "monto": entero en pesos colombianos, >= 0. Convierte palabras a números: "cinco mil" -> 5000, "veinte mil" -> 20000, "trescientos mil" -> 300000. Jerga colombiana: "una luca" -> 1000, "cinco lucas" -> 5000. Si no hay monto identificable, usa 0 y baja la confianza.
3. "descripcion": máximo 10 palabras (o el nombre de la meta para las intenciones de meta), reformulada de forma neutra. OMITE SIEMPRE nombres propios de personas, apodos y cualquier dato personal ("le compré un regalo a Valentina Gómez" -> "regalo para una amiga").
4. "categoria": exactamente una de: comida, transporte, entretenimiento, ropa, educacion, tecnologia, regalos, otros. Ante duda, "otros".
5. "confianza": 0 a 1. Usa < 0.5 si la frase es ruido, no menciona dinero, es incoherente o falta el monto.
6. Nunca inventes datos que no estén en la frase.

Ejemplos:
- "gasté cinco mil en un helado" -> {"intencion":"movimiento","tipo":"gasto","monto":5000,"descripcion":"helado","categoria":"comida","confianza":0.97}
- "ahorré veinte mil de mi mesada" -> {"intencion":"movimiento","tipo":"ahorro","monto":20000,"descripcion":"ahorro de mesada","categoria":"otros","confianza":0.95}
- "me gasté quince lucas en el bus" -> {"intencion":"movimiento","tipo":"gasto","monto":15000,"descripcion":"transporte","categoria":"transporte","confianza":0.9}
- "nueva meta bicicleta trescientos mil" -> {"intencion":"crear_meta","tipo":"ahorro","monto":300000,"descripcion":"bicicleta","categoria":"otros","confianza":0.92}
- "crear meta computador quinientos mil pesos" -> {"intencion":"crear_meta","tipo":"ahorro","monto":500000,"descripcion":"computador","categoria":"otros","confianza":0.9}
- "abonar diez mil a la bici" -> {"intencion":"abonar_meta","tipo":"ahorro","monto":10000,"descripcion":"bici","categoria":"otros","confianza":0.9}
- "eh mmm no sé qué decir hola hola" -> {"intencion":"movimiento","tipo":"gasto","monto":0,"descripcion":"registro no claro","categoria":"otros","confianza":0.1}`;

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

  // Intención desconocida degrada a 'movimiento' (lo más seguro: nunca crea una
  // meta por error de clasificación).
  const intencion = (MOVIMIENTO_INTENCIONES as readonly string[]).includes(String(r.intencion))
    ? (r.intencion as MovimientoIntencion)
    : 'movimiento';

  return {
    intencion,
    tipo: r.tipo,
    monto: r.monto,
    descripcion: r.descripcion.trim().slice(0, DESCRIPCION_MAX),
    categoria,
    confianza,
  };
}

/** Error from the model provider (network / HTTP / empty response) — retryable. */
export class ModelApiError extends Error {}

/**
 * Injectable model call: takes the system prompt + user text, returns the raw
 * JSON string the model produced. Tests pass a mock; production passes groqCaller.
 */
export type ModelCaller = (systemPrompt: string, userText: string) => Promise<string>;

// Groq: OpenAI-compatible chat completions. JSON mode (`response_format`) forces
// valid JSON; el SYSTEM_PROMPT ya describe el shape y los ejemplos, y
// parseClasificacion valida/normaliza. Modelo fácil de cambiar si Groq lo retira.
export const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_TIMEOUT_MS = 15_000;

/** Production ModelCaller: Groq (Llama) JSON-mode chat completion. */
export function groqCaller(apiKey: string): ModelCaller {
  return async (systemPrompt, userText) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText },
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 300,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new ModelApiError(`Groq HTTP ${res.status}: ${detail.slice(0, 300)}`);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new ModelApiError('Groq no devolvió texto.');
      return text;
    } catch (e) {
      if (e instanceof ModelApiError) throw e;
      // AbortError / network / DNS → also a provider-availability failure.
      throw new ModelApiError(e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Calls the model and returns the validated classification. */
export async function clasificarTexto(
  texto: string,
  call: ModelCaller
): Promise<ClasificacionMovimiento> {
  const raw = await call(SYSTEM_PROMPT, texto);
  return parseClasificacion(JSON.parse(raw));
}
