/** Error de red, HTTP o respuesta vacía del proveedor de IA. */
export class ModelApiError extends Error {}

/** Todos los modelos gratuitos de Groq alcanzaron su límite (HTTP 429). */
export class ModelRateLimitError extends ModelApiError {}

export type ModelCaller = (systemPrompt: string, userText: string) => Promise<string>;

// Plan gratuito de Groq: cada modelo tiene su propio cupo por minuto/día. Si uno
// responde 429 se prueba el siguiente; así la capacidad total es la suma de todos.
const GROQ_MODELS = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'] as const;

function modelOptions(model: string): Record<string, unknown> {
  return model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {};
}

export function groqCaller(
  apiKey: string,
  opts?: { maxTokens?: number; timeoutMs?: number }
): ModelCaller {
  const maxTokens = opts?.maxTokens ?? 300;
  const timeoutMs = opts?.timeoutMs ?? 15_000;
  return async (systemPrompt, userText) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      for (const model of GROQ_MODELS) {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userText },
            ],
            response_format: { type: 'json_object' },
            temperature: 0,
            max_tokens: maxTokens,
            ...modelOptions(model),
          }),
          signal: controller.signal,
        });
        if (res.status === 429 || res.status === 503) {
          await res.text().catch(() => '');
          continue;
        }
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new ModelApiError(`Groq HTTP ${res.status}: ${detail.slice(0, 300)}`);
        }
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new ModelApiError('Groq no devolvió texto.');
        return text;
      }
      throw new ModelRateLimitError('Groq: todos los modelos alcanzaron su límite.');
    } catch (error) {
      if (error instanceof ModelApiError) throw error;
      throw new ModelApiError(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }
  };
}
