/**
 * RQ-ES10/RQ-ES11 — Voice-diary text classification (the ONLY runtime AI in
 * Ceti, excepción D-ES10-01). Pure module: no firebase imports, the model call
 * is injected (ModelCaller) so tests can pass a mock. The model only ever sees
 * the transcript TEXT (audio never reaches our servers) and is instructed to
 * drop PII. Provider: Groq (Llama, JSON mode) — an implementation detail; the R7
 * exception is "server-side classification for the voice diary", not a vendor.
 *
 * v2 (RQ-ES11): one phrase → up to 5 classifications ({"movimientos":[...]}), and
 * each carries a relative date (offsetDias/diaSemana) that the CLIENT resolves to
 * a local date — the server never knows the device date.
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
// `no_entendido`: la frase no es un registro de dinero (off-topic) o es
// inapropiada (groserías/contenido sensible) → el cliente muestra "no te entendí".
export const MOVIMIENTO_INTENCIONES = [
  'movimiento',
  'abonar_meta',
  'crear_meta',
  'no_entendido',
] as const;

export type MovimientoIntencion = (typeof MOVIMIENTO_INTENCIONES)[number];

export type ClasificacionMovimiento = {
  intencion: MovimientoIntencion;
  tipo: 'ahorro' | 'gasto';
  monto: number;
  descripcion: string;
  categoria: MovimientoCategoria;
  confianza: number;
  // Desfase en días (−30..0; 0 = hoy) que el CLIENTE resuelve a fecha local. El
  // servidor jamás conoce la fecha del dispositivo. `diaSemana` es una pista
  // opcional adicional. Ninguno se persiste (son transporte).
  offsetDias: number;
  diaSemana?: string;
};

export const MONTO_MAX = 100_000_000;
export const DESCRIPCION_MAX = 140;
export const MAX_ITEMS = 5;

const DIAS_SEMANA = new Set([
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
]);

function normalizaDia(s: string): string {
  return s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export const SYSTEM_PROMPT = `Eres un clasificador de registros de dinero de bolsillo de estudiantes colombianos (13+). Recibes la transcripción de una o varias frases dichas por voz y produces EXACTAMENTE un JSON con la forma {"movimientos":[ ... ]}, donde cada elemento es una clasificación. Devuelve entre 1 y 5 elementos (máximo 5): si la persona menciona varios gastos/ahorros, crea un elemento por cada uno.

FILTRO (hazlo PRIMERO): decide si la frase es de verdad un registro de dinero del estudiante — un gasto, un ahorro, o algo sobre una meta de ahorro (crearla o abonarle). Si NO lo es (saludos, preguntas al azar, chistes, tareas del colegio, groserías, insultos, contenido sexual/violento/drogas, o ruido sin sentido), devuelve exactamente {"movimientos":[{"intencion":"no_entendido","tipo":"gasto","monto":0,"descripcion":"","categoria":"otros","confianza":0,"offsetDias":0}]} y nada más.
Sé TOLERANTE con intentos legítimos aunque estén mal dichos o incompletos ("gasté algo", "guardé plata", "ahorré para la bici" SÍ son válidos); baja la confianza si falta el monto. Rechaza solo lo que claramente NO es dinero propio o es inapropiado.

Para CADA registro válido:
1. "intencion": "crear_meta" si dice "nueva meta"/"crear meta" (descripcion = nombre de la meta, máx 4 palabras; monto = objetivo); "abonar_meta" si dice "abonar"/"aportar a mi meta"/"sumar a mi meta" (descripcion = nombre de la meta; monto = abono); en cualquier otro caso "movimiento".
2. "tipo": "ahorro" si guardó/recibió/apartó; "gasto" si gastó/compró/pagó. Para crear_meta y abonar_meta usa siempre "ahorro".
3. "monto": entero en pesos colombianos, >= 0. Convierte palabras a números ("cinco mil" -> 5000, "trescientos mil" -> 300000). Jerga colombiana: "una luca"/"un billete" -> 1000, "cinco lucas" -> 5000, "cinco barras" -> 5000, "media" -> 500. "quincena" se refiere al pago quincenal, no es un monto en sí. Si no hay monto identificable, usa 0 y baja la confianza.
4. "descripcion": máximo 10 palabras (o el nombre de la meta), neutra. OMITE SIEMPRE nombres propios de personas, apodos y datos personales.
5. "categoria": exactamente una de: comida, transporte, entretenimiento, ropa, educacion, tecnologia, regalos, otros. Ante duda, "otros".
6. "confianza": 0 a 1.
7. "offsetDias": entero de -30 a 0 con hace cuántos días ocurrió, según las palabras de tiempo. 0 = hoy (por defecto). "ayer" -> -1, "antier"/"anteayer" -> -2, "hace tres días" -> -3, "la semana pasada" -> aprox -7. NUNCA valores positivos (nada de futuro). Sin indicación de tiempo, usa 0.
8. "diaSemana": si la frase nombra un día ("el viernes", "el lunes pasado"), pon ese día en minúsculas y sin tilde (lunes, martes, miercoles, jueves, viernes, sabado, domingo); si no, omite el campo.
Nunca inventes datos que no estén en la frase. Nunca conoces la fecha de hoy: solo describes el desfase con offsetDias/diaSemana.

Ejemplos:
- "gasté cinco mil en un helado" -> {"movimientos":[{"intencion":"movimiento","tipo":"gasto","monto":5000,"descripcion":"helado","categoria":"comida","confianza":0.97,"offsetDias":0}]}
- "ayer gasté una luca en el bus y guardé diez mil de la mesada" -> {"movimientos":[{"intencion":"movimiento","tipo":"gasto","monto":1000,"descripcion":"transporte","categoria":"transporte","confianza":0.9,"offsetDias":-1},{"intencion":"movimiento","tipo":"ahorro","monto":10000,"descripcion":"ahorro de mesada","categoria":"otros","confianza":0.9,"offsetDias":-1}]}
- "el viernes pagué quince mil de ropa" -> {"movimientos":[{"intencion":"movimiento","tipo":"gasto","monto":15000,"descripcion":"ropa","categoria":"ropa","confianza":0.9,"offsetDias":0,"diaSemana":"viernes"}]}
- "nueva meta bicicleta trescientos mil" -> {"movimientos":[{"intencion":"crear_meta","tipo":"ahorro","monto":300000,"descripcion":"bicicleta","categoria":"otros","confianza":0.92,"offsetDias":0}]}
- "abonar diez mil a la bici" -> {"movimientos":[{"intencion":"abonar_meta","tipo":"ahorro","monto":10000,"descripcion":"bici","categoria":"otros","confianza":0.9,"offsetDias":0}]}
- "cuánto es dos más dos" -> {"movimientos":[{"intencion":"no_entendido","tipo":"gasto","monto":0,"descripcion":"","categoria":"otros","confianza":0,"offsetDias":0}]}`;

const NO_ENTENDIDO: ClasificacionMovimiento = {
  intencion: 'no_entendido',
  tipo: 'gasto',
  monto: 0,
  descripcion: '',
  categoria: 'otros',
  confianza: 0,
  offsetDias: 0,
};

function normalizarFecha(r: Record<string, unknown>): { offsetDias: number; diaSemana?: string } {
  let offsetDias = 0;
  if (typeof r.offsetDias === 'number' && Number.isFinite(r.offsetDias)) {
    const o = Math.trunc(r.offsetDias);
    offsetDias = o > 0 ? 0 : o < -30 ? -30 : o; // nunca futuro; clamp a -30
  }
  const dia = typeof r.diaSemana === 'string' ? normalizaDia(r.diaSemana) : '';
  return DIAS_SEMANA.has(dia) ? { offsetDias, diaSemana: dia } : { offsetDias };
}

/**
 * Valida/normaliza UN registro crudo del modelo. Devuelve `null` (en vez de
 * lanzar) cuando el ítem es irrecuperable, para que un ítem malo no tumbe a los
 * válidos del lote. Normaliza lo recuperable (categoría desconocida -> 'otros'
 * con confianza penalizada, clamp de confianza, recorte de descripción, fecha).
 */
export function parseItem(raw: unknown): ClasificacionMovimiento | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  // Rechazo del modelo (off-topic o inapropiado): cortocircuita antes de validar
  // tipo/monto — son irrelevantes aquí. El cliente muestra "no te entendí".
  if (r.intencion === 'no_entendido') return { ...NO_ENTENDIDO };

  if (r.tipo !== 'ahorro' && r.tipo !== 'gasto') return null;
  if (
    typeof r.monto !== 'number' ||
    !Number.isInteger(r.monto) ||
    r.monto < 0 ||
    r.monto > MONTO_MAX
  ) {
    return null;
  }
  if (typeof r.descripcion !== 'string' || typeof r.confianza !== 'number') return null;

  let confianza = Math.min(1, Math.max(0, r.confianza));
  let categoria: MovimientoCategoria;
  if ((MOVIMIENTO_CATEGORIAS as readonly string[]).includes(String(r.categoria))) {
    categoria = r.categoria as MovimientoCategoria;
  } else {
    // ponytail: categoría desconocida degrada a 'otros' en vez de tumbar el ítem
    categoria = 'otros';
    confianza = Math.min(confianza, 0.5);
  }

  // Intención desconocida degrada a 'movimiento' (lo más seguro: nunca crea una
  // meta por un error de clasificación).
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
    ...normalizarFecha(r),
  };
}

/** Valida un solo registro y LANZA si es irrecuperable (compat de un ítem). */
export function parseClasificacion(raw: unknown): ClasificacionMovimiento {
  const item = parseItem(raw);
  if (!item) throw new Error('Clasificación inválida.');
  return item;
}

/**
 * Normaliza la respuesta del modelo a una lista de 1..5 clasificaciones.
 * Acepta el shape v2 ({"movimientos":[...]}) o un objeto plano legacy (lo
 * envuelve). Descarta ítems inválidos sin tumbar los válidos; en lote (>1)
 * descarta `no_entendido` y `crear_meta` (esos son flujos de un solo ítem). Si
 * no queda ninguno, devuelve el rechazo canónico.
 */
export function parseClasificaciones(raw: unknown): ClasificacionMovimiento[] {
  const items: unknown[] =
    raw && typeof raw === 'object' && Array.isArray((raw as { movimientos?: unknown }).movimientos)
      ? (raw as { movimientos: unknown[] }).movimientos
      : [raw];

  let parsed = items.map(parseItem).filter((x): x is ClasificacionMovimiento => x !== null);

  if (parsed.length > 1) {
    parsed = parsed.filter((x) => x.intencion !== 'no_entendido' && x.intencion !== 'crear_meta');
  }
  parsed = parsed.slice(0, MAX_ITEMS);

  return parsed.length > 0 ? parsed : [{ ...NO_ENTENDIDO }];
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
// parseClasificaciones valida/normaliza. Modelo fácil de cambiar si Groq lo retira.
export const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_TIMEOUT_MS = 15_000;

/**
 * Production ModelCaller: Groq (Llama) JSON-mode chat completion. Defaults fit
 * the short voice classification; multi-movimiento passes a larger token budget
 * (procesarRegistroVoz sube maxTokens a 600 para que las frases de 4-5 ítems no
 * se trunquen) y el world-draft generator pasa el suyo.
 */
export function groqCaller(
  apiKey: string,
  opts?: { maxTokens?: number; timeoutMs?: number }
): ModelCaller {
  const maxTokens = opts?.maxTokens ?? 300;
  const timeoutMs = opts?.timeoutMs ?? GROQ_TIMEOUT_MS;
  return async (systemPrompt, userText) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
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
          max_tokens: maxTokens,
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

/** Calls the model and returns the validated list of 1..5 classifications. */
export async function clasificarTexto(
  texto: string,
  call: ModelCaller
): Promise<ClasificacionMovimiento[]> {
  const raw = await call(SYSTEM_PROMPT, texto);
  return parseClasificaciones(JSON.parse(raw));
}
