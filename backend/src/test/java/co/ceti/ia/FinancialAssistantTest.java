package co.ceti.ia;

import static co.ceti.ia.FinancialAssistant.buildFinancialPrompt;
import static co.ceti.ia.FinancialAssistant.classifyFinancialAssistantError;
import static co.ceti.ia.FinancialAssistant.isFinancialAssistantQuotaExceeded;
import static co.ceti.ia.FinancialAssistant.parseFinancialContext;
import static co.ceti.ia.FinancialAssistant.planFinancialActions;
import static co.ceti.ia.FinancialAssistant.planFinancialActionsWithQuota;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import co.ceti.ia.FinancialAssistant.AssistantError;
import co.ceti.ia.FinancialAssistant.FinancialRequestException;
import co.ceti.ia.FinancialAssistant.QuotaExceededException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.JsonNode;

class FinancialAssistantTest {

  private static final Map<String, Object> EMPTY_CONTEXT =
      Map.of("goals", List.of(), "movements", List.of());

  private static JsonNode tree(Object value) {
    return Js.MAPPER.valueToTree(value);
  }

  private static JsonNode request(String text, Object context) {
    return tree(Map.of("text", text, "requestId", "r1", "context", context));
  }

  /** Fake del modelo: registra el texto de usuario de cada llamada y responde fijo. */
  private static ModelCaller replying(String response, List<String> userTexts) {
    return (systemPrompt, userText) -> {
      userTexts.add(userText);
      return response;
    };
  }

  private static ModelCaller replyingAction(Object action, List<String> userTexts) {
    return replying(Js.MAPPER.writeValueAsString(Map.of("actions", List.of(action))), userTexts);
  }

  private static String untrustedText(String userText) {
    return Js.MAPPER.readTree(userText).get("untrustedData").get("text").stringValue();
  }

  @Test
  void elContextoNoAceptaCamposDeIdentidad() {
    FinancialAssistant.FinancialContext context =
        parseFinancialContext(
            tree(
                Map.of(
                    "goals", List.of(Map.of("id", "g1", "title", "Bici", "targetAmount", 300000)),
                    "movements",
                        List.of(
                            Map.of(
                                "id", "m1",
                                "tipo", "gasto",
                                "monto", 10000,
                                "descripcion", "almuerzo",
                                "categoria", "comida",
                                "fecha", 10)))));
    assertThat(context.goals()).hasSize(1);

    assertThatThrownBy(
            () ->
                parseFinancialContext(
                    tree(Map.of("uid", "u1", "goals", List.of(), "movements", List.of()))))
        .isInstanceOf(FinancialRequestException.class);
  }

  @Test
  void elPromptDeSistemaEsEstaticoYTrataElUserJsonComoDatosNoConfiables() {
    String prompt = buildFinancialPrompt();
    assertThat(prompt)
        .contains(
            "datos no confiables",
            "movimiento",
            "ahorro",
            "meta",
            "consultar | crear | editar | eliminar",
            "monto",
            "targetAmount",
            "resourceId",
            "needsInput",
            "Máximo 5 acciones",
            "Nunca inventes IDs")
        .doesNotContain("g1")
        .isEqualTo(buildFinancialPrompt());
  }

  @ParameterizedTest
  @MethodSource("textosFueraDeRango")
  void rechazaTextoFueraDeRango(String text) {
    List<String> calls = new ArrayList<>();
    assertThatThrownBy(
            () -> planFinancialActions(request(text, EMPTY_CONTEXT), replying("{}", calls)))
        .isInstanceOf(FinancialRequestException.class);
  }

  static Stream<String> textosFueraDeRango() {
    return Stream.of("", " ".repeat(3), "a".repeat(301));
  }

  @Test
  void rechazaMasDe30RecursosDeContexto() {
    List<Map<String, Object>> goals =
        IntStream.range(0, 31)
            .mapToObj(
                index -> Map.<String, Object>of("id", "g" + index, "title", "Meta", "targetAmount", 100))
            .toList();
    assertThatThrownBy(
            () ->
                parseFinancialContext(
                    tree(Map.of("goals", goals, "movements", List.of(), "operations", List.of()))))
        .isInstanceOf(FinancialRequestException.class);
  }

  @Test
  void enviaSoloTextoYContextoAlModeloYValidaElPlanDevuelto() {
    List<String> calls = new ArrayList<>();
    List<String> systemPrompts = new ArrayList<>();
    ModelCaller model =
        (systemPrompt, userText) -> {
          systemPrompts.add(systemPrompt);
          calls.add(userText);
          return "{\"actions\":[{\"domain\":\"meta\",\"operation\":\"consultar\",\"payload\":{},\"needsInput\":[]}]}";
        };

    FinancialPlan result = planFinancialActions(request("muéstrame mis metas", EMPTY_CONTEXT), model);

    assertThat(result.actions().get(0).actionId()).isEqualTo("r1:0");
    assertThat(systemPrompts.get(0)).isEqualTo(buildFinancialPrompt());
    assertThat(Js.MAPPER.readTree(calls.get(0)))
        .isEqualTo(
            tree(
                Map.of(
                    "untrustedData",
                    Map.of(
                        "text", "muéstrame mis metas",
                        "context",
                            Map.of(
                                "goals", List.of(), "movements", List.of(), "operations", List.of())))));
  }

  @Test
  void expandeKYConservaLaInstruccionDeClasificarDineroEncontradoComoAhorro() {
    List<String> calls = new ArrayList<>();
    planFinancialActions(
        request("me encontré 50K pesos en el suelo", EMPTY_CONTEXT),
        replyingAction(
            Map.of(
                "domain", "ahorro",
                "operation", "crear",
                "payload",
                    Map.of("type", "aporte", "amount", 50000, "description", "TEXT_0", "fecha", 1),
                "needsInput", List.of()),
            calls));

    assertThat(untrustedText(calls.get(0))).contains("50000", "encontré");
    assertThat(buildFinancialPrompt()).contains("encuentra");
  }

  static Stream<Arguments> pistasDeCategoria() {
    return Stream.of(
        Arguments.of("gasté 50K en un helado", "helado", "comida"),
        Arguments.of("gasté 20K en una salida con mi novia", "salida", "entretenimiento"));
  }

  @ParameterizedTest
  @MethodSource("pistasDeCategoria")
  void conservaLaPalabraComoPistaParaLaCategoria(String text, String keyword, String category) {
    List<String> calls = new ArrayList<>();
    planFinancialActions(
        request(text, EMPTY_CONTEXT),
        replyingAction(
            Map.of(
                "domain", "movimiento",
                "operation", "crear",
                "payload",
                    Map.of(
                        "tipo", "gasto",
                        "monto", text.contains("50K") ? 50000 : 20000,
                        "descripcion", "TEXT_0",
                        "categoria", category,
                        "fecha", 1),
                "needsInput", List.of()),
            calls));

    assertThat(untrustedText(calls.get(0))).contains(keyword);
    assertThat(buildFinancialPrompt()).contains(keyword + " → " + category);
  }

  @Test
  void seudonimizaYRehidrataLaDescripcionDeUnGasto() {
    List<String> calls = new ArrayList<>();
    FinancialPlan result =
        planFinancialActions(
            request("gasté 20000 en almuerzo en El Corral", EMPTY_CONTEXT),
            replyingAction(
                Map.of(
                    "domain", "movimiento",
                    "operation", "crear",
                    "payload",
                        Map.of(
                            "tipo", "gasto",
                            "monto", 20000,
                            "descripcion", "TEXT_0 en TEXT_1",
                            "categoria", "comida",
                            "fecha", 1),
                    "needsInput", List.of()),
                calls));

    String modelText = untrustedText(calls.get(0));
    assertThat(modelText).isEqualTo("gasté 20000 en TEXT_0 en TEXT_1");
    assertThat(modelText).doesNotContainPattern("(?i)almuerzo|corral");
    assertThat(result.actions().get(0).payload().get("descripcion").stringValue())
        .isEqualTo("almuerzo en El Corral");
  }

  @Test
  void seudonimizaYRehidrataElTituloDeUnaMeta() {
    List<String> calls = new ArrayList<>();
    FinancialPlan result =
        planFinancialActions(
            request("crea una meta para viaje familiar por 3000000", EMPTY_CONTEXT),
            replyingAction(
                Map.of(
                    "domain", "meta",
                    "operation", "crear",
                    "payload",
                        Map.of(
                            "title", "TEXT_0",
                            "iconId", "plane",
                            "category", "trip",
                            "targetAmount", 3000000),
                    "needsInput", List.of()),
                calls));

    String modelText = untrustedText(calls.get(0));
    assertThat(modelText).isEqualTo("crea una meta para TEXT_0 por 3000000");
    assertThat(modelText).doesNotContain("viaje familiar");
    assertThat(result.actions().get(0).payload().get("title").stringValue())
        .isEqualTo("viaje familiar");
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "escríbeme a menor@ejemplo.com sobre el gasto",
        "mi teléfono es 300 123 4567 y gasté 10000",
        "llama al 3001234567 para confirmar el gasto",
        "whatsapp: +57 300-123-4567",
        "contacto 601 234 5678 y crea un ahorro",
        "mi documento es 1020304050 y ahorré 10000",
        "cédula número 1020304050 y ahorré 10000",
        "mi nombre es Juan Pérez y crea una meta",
        "soy Juan Pérez y crea una meta",
        "transferí a Juan Pérez, vive en Calle 10 #20-30",
        "regalo para Ana Pérez por 20000",
        "transferí a juan pérez 10000",
        "gasté con Juan Pérez 10000",
        "aporte de Juan Pérez por 10000",
        "pagué en la dirección Calle 10 #20-30",
        "vive en carrera 7 # 12-34 y gasté 10000",
        "mi vivienda queda en avenida 19 # 10-20"
      })
  void rechazaPiiClaraAntesDeLlamarAlModelo(String text) {
    List<String> calls = new ArrayList<>();
    assertThatThrownBy(
            () -> planFinancialActions(request(text, EMPTY_CONTEXT), replying("{}", calls)))
        .isInstanceOf(FinancialRequestException.class)
        .hasMessageContaining("datos personales");
    assertThat(calls).isEmpty();
  }

  static Stream<Arguments> textosLibres() {
    return Stream.of(
        Arguments.of("Juan Pérez me prestó 20000", "(?i)Juan|Pérez|prestó"),
        Arguments.of("regalo Juan Pérez", "(?i)Juan|Pérez"),
        Arguments.of("escribe al teléfono", "(?i)escribe|teléfono"));
  }

  @ParameterizedTest
  @MethodSource("textosLibres")
  void ningunTextoLibreCruzaAlModelo(String text, String freeText) {
    List<String> calls = new ArrayList<>();
    planFinancialActions(
        request(text, EMPTY_CONTEXT),
        replying(
            "{\"actions\":[{\"domain\":\"meta\",\"operation\":\"consultar\",\"payload\":{},\"needsInput\":[]}]}",
            calls));

    assertThat(calls.get(0)).doesNotContainPattern(Pattern.compile(freeText));
    assertThat(untrustedText(calls.get(0))).contains("TEXT_");
  }

  @Test
  void rechazaUnDocumentoEscritoComoCcAntesDelModelo() {
    List<String> calls = new ArrayList<>();
    assertThatThrownBy(
            () ->
                planFinancialActions(
                    request("CC 1020304050 y ahorré 10000", EMPTY_CONTEXT), replying("{}", calls)))
        .isInstanceOf(FinancialRequestException.class)
        .hasMessageContaining("datos personales");
    assertThat(calls).isEmpty();
  }

  @ParameterizedTest
  @ValueSource(longs = {8_640_000_000_000_000L, 8_640_000_000_000_001L})
  void validaElLimiteSuperiorDeTimestampDelContexto(long fecha) {
    JsonNode context =
        tree(
            Map.of(
                "goals", List.of(),
                "movements",
                    List.of(
                        Map.of(
                            "id", "m1",
                            "tipo", "gasto",
                            "monto", 100,
                            "descripcion", "almuerzo",
                            "categoria", "comida",
                            "fecha", fecha))));
    if (fecha == 8_640_000_000_000_000L) {
      assertThatCode(() -> parseFinancialContext(context)).doesNotThrowAnyException();
    } else {
      assertThatThrownBy(() -> parseFinancialContext(context))
          .hasMessageContaining("movement inválido");
    }
  }

  @Test
  void elPromptExigeNeedsInputCuandoUnaReferenciaNoSePuedeResolver() {
    assertThat(buildFinancialPrompt()).contains("referencia no se puede resolver", "needsInput");
  }

  static Stream<Arguments> idsInventados() {
    return Stream.of(
        Arguments.of(
            Map.of("goals", List.of(), "movements", List.of(), "operations", List.of()),
            Map.of(
                "domain", "meta",
                "operation", "eliminar",
                "resourceId", "inventada",
                "payload", Map.of())),
        Arguments.of(
            Map.of(
                "goals", List.of(Map.of("id", "g1", "title", "Bici", "targetAmount", 100)),
                "movements", List.of()),
            Map.of(
                "domain", "movimiento",
                "operation", "crear",
                "payload",
                    Map.of(
                        "tipo", "ahorro",
                        "monto", 100,
                        "descripcion", "aporte",
                        "categoria", "otros",
                        "fecha", 1,
                        "goalId", "g2"))));
  }

  @ParameterizedTest
  @MethodSource("idsInventados")
  void rechazaIdsInventadosPorElModelo(Map<String, Object> context, Map<String, Object> action) {
    List<String> calls = new ArrayList<>();
    assertThatThrownBy(
            () -> planFinancialActions(request("elimina meta", context), replyingAction(action, calls)))
        .isInstanceOf(FinancialPlan.InvalidPlanException.class)
        .hasMessageContaining("ID fuera del contexto");
  }

  @Test
  void rechazaUnPlanInvalidoDelModelo() {
    List<String> calls = new ArrayList<>();
    assertThatThrownBy(
            () ->
                planFinancialActions(
                    request("borra todo", EMPTY_CONTEXT), replying("{\"actions\":[]}", calls)))
        .hasMessageContaining("entre una y cinco acciones");
  }

  @Test
  void clasificaEntradaSeparadaDeFallosDelModeloODeSuRespuesta() {
    assertError(
        classifyFinancialAssistantError(new FinancialRequestException("text inválido")),
        HttpStatus.BAD_REQUEST, "invalid-argument", "text inválido", null);
    assertError(
        classifyFinancialAssistantError(new QuotaExceededException()),
        HttpStatus.TOO_MANY_REQUESTS, "resource-exhausted", "Límite diario del asistente alcanzado.", null);
    assertError(
        classifyFinancialAssistantError(new ModelApiException("raw secreto")),
        HttpStatus.SERVICE_UNAVAILABLE, "unavailable", "No pude organizar la solicitud.", "model-api");
    assertError(
        classifyFinancialAssistantError(new FinancialPlan.InvalidPlanException("respuesta raw")),
        HttpStatus.SERVICE_UNAVAILABLE, "unavailable", "No pude organizar la solicitud.", "model-output");
    assertError(
        classifyFinancialAssistantError(new IllegalStateException("respuesta raw")),
        HttpStatus.SERVICE_UNAVAILABLE, "unavailable", "No pude organizar la solicitud.", "unexpected");
  }

  private static void assertError(
      AssistantError mapped, HttpStatus status, String code, String message, String logCode) {
    assertThat(mapped.error().status()).isEqualTo(status);
    assertThat(mapped.error().code()).isEqualTo(code);
    assertThat(mapped.error().getMessage()).isEqualTo(message);
    assertThat(mapped.logCode()).isEqualTo(logCode);
  }

  @Test
  void laCuotaPermite99ExitosYBloqueaDesde100() {
    assertThat(isFinancialAssistantQuotaExceeded(99)).isFalse();
    assertThat(isFinancialAssistantQuotaExceeded(100)).isTrue();
  }

  @Test
  void noLlamaAlModeloCuandoNoPuedeReservarCuota() {
    List<String> calls = new ArrayList<>();
    assertThatThrownBy(
            () ->
                planFinancialActionsWithQuota(
                    request("gaste 100", EMPTY_CONTEXT),
                    replying("{}", calls),
                    () -> {
                      throw new RuntimeException("quota");
                    }))
        .hasMessage("quota");
    assertThat(calls).isEmpty();
  }

  @Test
  void reservaElIntentoAntesDelModeloYLoConservaSiGroqFalla() {
    List<String> events = new ArrayList<>();
    ModelCaller failing =
        (systemPrompt, userText) -> {
          events.add("model");
          throw new ModelApiException("Groq no disponible");
        };

    assertThatThrownBy(
            () ->
                planFinancialActionsWithQuota(
                    request("gaste 100", EMPTY_CONTEXT), failing, () -> events.add("reserve")))
        .isInstanceOf(ModelApiException.class)
        .hasMessage("Groq no disponible");
    assertThat(events).containsExactly("reserve", "model");
  }
}
