package co.ceti.ia;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/** Proveedor de IA: Groq vía su API compatible con OpenAI. */
public final class GroqClient {

  static final String GROQ_MODEL = "qwen/qwen3.8-27b";
  private static final URI GROQ_URI = URI.create("https://api.groq.com/openai/v1/chat/completions");
  private static final HttpClient HTTP = HttpClient.newHttpClient();

  private GroqClient() {}

  public static ModelCaller caller(String apiKey, int maxTokens, Duration timeout) {
    return caller(GROQ_URI, apiKey, maxTokens, timeout);
  }

  static ModelCaller caller(URI endpoint, String apiKey, int maxTokens, Duration timeout) {
    return (systemPrompt, userText) -> {
      HttpRequest request =
          HttpRequest.newBuilder(endpoint)
              .header("content-type", "application/json")
              .header("authorization", "Bearer " + apiKey)
              .POST(HttpRequest.BodyPublishers.ofString(body(systemPrompt, userText, maxTokens)))
              .build();
      HttpResponse<String> response = send(request, timeout);
      if (response.statusCode() < 200 || response.statusCode() > 299) {
        throw new ModelApiException(
            "Groq HTTP " + response.statusCode() + ": " + Js.slice(response.body(), 300));
      }
      JsonNode content =
          Js.parseJson(response.body())
              .orElseThrow(() -> new ModelApiException("Groq devolvió JSON inválido."))
              .path("choices")
              .path(0)
              .path("message")
              .path("content");
      if (!content.isString() || content.stringValue().isEmpty()) {
        throw new ModelApiException("Groq no devolvió texto.");
      }
      return content.stringValue();
    };
  }

  private static String body(String systemPrompt, String userText, int maxTokens) {
    ObjectNode body = Js.MAPPER.createObjectNode();
    body.put("model", GROQ_MODEL);
    body.putArray("messages")
        .add(Js.MAPPER.createObjectNode().put("role", "system").put("content", systemPrompt))
        .add(Js.MAPPER.createObjectNode().put("role", "user").put("content", userText));
    body.putObject("response_format").put("type", "json_object");
    body.put("temperature", 0);
    body.put("max_tokens", maxTokens);
    return Js.MAPPER.writeValueAsString(body);
  }

  // El timeout cubre la respuesta completa (cabeceras + cuerpo), como el AbortController del
  // original; HttpRequest.timeout solo cubriría hasta las cabeceras.
  private static HttpResponse<String> send(HttpRequest request, Duration timeout) {
    CompletableFuture<HttpResponse<String>> pending =
        HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString());
    try {
      return pending.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
    } catch (TimeoutException e) {
      pending.cancel(true);
      throw new ModelApiException("Groq excedió el tiempo de espera.");
    } catch (ExecutionException e) {
      Throwable cause = e.getCause() == null ? e : e.getCause();
      throw new ModelApiException(
          Objects.toString(cause.getMessage(), cause.getClass().getSimpleName()));
    } catch (InterruptedException e) {
      pending.cancel(true);
      Thread.currentThread().interrupt();
      throw new ModelApiException("Llamada a Groq interrumpida.");
    }
  }
}
