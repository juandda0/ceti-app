package co.ceti.ia;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class GroqClientTest {

  private HttpServer server;

  @AfterEach
  void stopServer() {
    if (server != null) server.stop(0);
  }

  private URI serve(HttpHandler handler) throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/", handler);
    server.start();
    return URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/");
  }

  private static HttpHandler respond(int status, String body) {
    return exchange -> {
      byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(status, bytes.length);
      exchange.getResponseBody().write(bytes);
      exchange.close();
    };
  }

  @Test
  void usaUnModeloDeGroqActualmenteDisponibleParaOrganizarRegistros() throws IOException {
    AtomicReference<String> requestBody = new AtomicReference<>();
    HttpHandler ok = respond(200, "{\"choices\":[{\"message\":{\"content\":\"{\\\"actions\\\":[]}\"}}]}");
    URI endpoint =
        serve(
            exchange -> {
              requestBody.set(
                  new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
              ok.handle(exchange);
            });

    String text =
        GroqClient.caller(endpoint, "clave-de-prueba", 300, Duration.ofSeconds(5))
            .call("sistema", "solicitud");

    assertThat(text).isEqualTo("{\"actions\":[]}");
    assertThat(Js.MAPPER.readTree(requestBody.get()).get("model").stringValue())
        .isEqualTo("qwen/qwen3.8-27b");
  }

  @Test
  void convierteUnHttpNoExitosoEnModelApiException() throws IOException {
    URI endpoint = serve(respond(503, "sobrecargado"));

    assertThatThrownBy(
            () ->
                GroqClient.caller(endpoint, "k", 300, Duration.ofSeconds(5)).call("sistema", "x"))
        .isInstanceOf(ModelApiException.class)
        .hasMessage("Groq HTTP 503: sobrecargado");
  }

  @Test
  void convierteElTimeoutEnModelApiException() throws IOException {
    URI endpoint =
        serve(
            exchange -> {
              try {
                Thread.sleep(2_000);
              } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
              }
              exchange.close();
            });

    assertThatThrownBy(
            () ->
                GroqClient.caller(endpoint, "k", 300, Duration.ofMillis(100)).call("sistema", "x"))
        .isInstanceOf(ModelApiException.class);
  }
}
