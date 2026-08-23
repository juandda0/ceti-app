/** Error de red, HTTP o respuesta vacía del proveedor de IA. */
export class ModelApiError extends Error {}

export type ModelCaller = (systemPrompt: string, userText: string) => Promise<string>;

const GROQ_MODEL = 'llama-3.3-70b-versatile';

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
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new ModelApiError('Groq no devolvió texto.');
      return text;
    } catch (error) {
      if (error instanceof ModelApiError) throw error;
      throw new ModelApiError(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }
  };
}
