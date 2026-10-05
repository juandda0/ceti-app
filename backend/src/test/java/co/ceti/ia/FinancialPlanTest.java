package co.ceti.ia;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import co.ceti.ia.FinancialPlan.InvalidPlanException;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

class FinancialPlanTest {

  private static String json(Object value) {
    return Js.MAPPER.writeValueAsString(value);
  }

  private static FinancialPlan parseActions(Object... actions) {
    return FinancialPlan.parseFinancialPlan(json(Map.of("actions", List.of(actions))), "r");
  }

  private static Map<String, Object> with(Map<String, Object> base, String key, Object value) {
    Map<String, Object> copy = new HashMap<>(base);
    copy.put(key, value);
    return copy;
  }

  private static final Map<String, Object> GASTO =
      Map.of("tipo", "gasto", "monto", 1, "descripcion", "x", "categoria", "comida", "fecha", 1);

  @Test
  void aceptaHastaCincoAccionesYAsignaIdsEstables() {
    FinancialPlan plan =
        FinancialPlan.parseFinancialPlan(
            json(
                Map.of(
                    "actions",
                    List.of(
                        Map.of(
                            "domain", "movimiento",
                            "operation", "crear",
                            "payload",
                                Map.of(
                                    "tipo", "gasto",
                                    "monto", 12000,
                                    "descripcion", "almuerzo",
                                    "categoria", "comida",
                                    "fecha", 10)),
                        Map.of(
                            "domain", "meta",
                            "operation", "eliminar",
                            "resourceId", "goal_1",
                            "payload", Map.of())))),
            "req_1");

    assertThat(plan.actions()).extracting(FinancialPlan.Action::actionId)
        .containsExactly("req_1:0", "req_1:1");
    assertThat(plan.actions()).extracting(FinancialPlan.Action::needsInput)
        .containsExactly(List.of(), List.of());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{}",
        "{\"actions\":[]}",
        "{\"actions\":[{\"domain\":\"usuario\",\"operation\":\"eliminar\",\"payload\":{}}]}",
        "{\"actions\":[{\"domain\":\"movimiento\",\"operation\":\"crear\",\"payload\":{\"monto\":-1}}]}"
      })
  void rechazaPlanInvalido(String raw) {
    assertThatThrownBy(() -> FinancialPlan.parseFinancialPlan(raw, "r"))
        .isInstanceOf(InvalidPlanException.class);
  }

  @Test
  void rechazaMasDeCincoAccionesYCamposAdicionales() {
    Map<String, Object> action = Map.of("domain", "meta", "operation", "consultar", "payload", Map.of());
    assertThatThrownBy(() -> parseActions(Collections.nCopies(6, action).toArray()))
        .isInstanceOf(InvalidPlanException.class);
    assertThatThrownBy(() -> parseActions(with(action, "ignored", true)))
        .isInstanceOf(InvalidPlanException.class);
    assertThatThrownBy(
            () ->
                FinancialPlan.parseFinancialPlan(
                    json(Map.of("actions", List.of(action), "ignored", true)), "r"))
        .isInstanceOf(InvalidPlanException.class);
  }

  @ParameterizedTest
  @ValueSource(strings = {"consultar", "crear"})
  void rechazaResourceIdEnMovimiento(String operation) {
    Map<String, Object> payload = operation.equals("crear") ? GASTO : Map.of();

    assertThatThrownBy(
            () ->
                parseActions(
                    Map.of(
                        "domain", "movimiento",
                        "operation", operation,
                        "resourceId", "mov_1",
                        "payload", payload)))
        .isInstanceOf(InvalidPlanException.class);
  }

  @Test
  void aceptaFiltrarUnaConsultaDeMetaPorResourceId() {
    FinancialPlan.Action action =
        parseActions(
                Map.of(
                    "domain", "meta",
                    "operation", "consultar",
                    "resourceId", "goal_1",
                    "payload", Map.of()))
            .actions()
            .get(0);

    assertThat(action.domain()).isEqualTo("meta");
    assertThat(action.operation()).isEqualTo("consultar");
    assertThat(action.resourceId()).isEqualTo("goal_1");
  }

  @Test
  void validaLimitesEnumsYPayloadsCerrados() {
    assertThatThrownBy(
            () ->
                parseActions(
                    Map.of(
                        "domain", "movimiento",
                        "operation", "crear",
                        "payload", with(GASTO, "monto", 100_000_001))))
        .isInstanceOf(InvalidPlanException.class);
    Map<String, Object> malformed = with(GASTO, "descripcion", "x".repeat(141));
    malformed.put("categoria", "inventada");
    malformed.put("extra", true);
    assertThatThrownBy(
            () ->
                parseActions(
                    Map.of("domain", "movimiento", "operation", "crear", "payload", malformed)))
        .isInstanceOf(InvalidPlanException.class);
    assertThatThrownBy(
            () ->
                parseActions(
                    Map.of(
                        "domain", "ahorro",
                        "operation", "eliminar",
                        "payload", Map.of(),
                        "resourceId", "")))
        .isInstanceOf(InvalidPlanException.class);
  }

  @Test
  void aceptaLosPayloadsDeAhorroYMetaQueConsumiraElEjecutor() {
    FinancialPlan plan =
        FinancialPlan.parseFinancialPlan(
            json(
                Map.of(
                    "actions",
                    List.of(
                        Map.of(
                            "domain", "ahorro",
                            "operation", "crear",
                            "payload",
                                Map.of(
                                    "type", "aporte",
                                    "amount", 5000,
                                    "description", "aporte bici",
                                    "goalId", "g1",
                                    "fecha", 20)),
                        Map.of(
                            "domain", "meta",
                            "operation", "crear",
                            "payload",
                                Map.of(
                                    "title", "Bici",
                                    "iconId", "bike",
                                    "category", "custom",
                                    "targetAmount", 500000),
                            "needsInput", List.of("deadline"))))),
            "req");

    assertThat(plan.actions()).hasSize(2);
    assertThat(plan.actions().get(1).needsInput()).containsExactly("deadline");
  }

  @Test
  void rechazaTimestampsFraccionariosInsegurosFueraDeDateYRangosInvertidos() {
    assertThatThrownBy(() -> parseActions(query(1.5, 2))).isInstanceOf(InvalidPlanException.class);
    assertThatThrownBy(() -> parseActions(query(0, 9_007_199_254_740_992L)))
        .isInstanceOf(InvalidPlanException.class);
    assertThatThrownBy(() -> parseActions(query(0, 8_640_000_000_000_001L)))
        .isInstanceOf(InvalidPlanException.class);
    assertThatThrownBy(() -> parseActions(query(2, 1))).isInstanceOf(InvalidPlanException.class);
  }

  private static Map<String, Object> query(Number desde, Number hasta) {
    return Map.of(
        "domain", "movimiento",
        "operation", "consultar",
        "payload", Map.of("desde", desde, "hasta", hasta));
  }

  @ParameterizedTest
  @ValueSource(strings = {" espacio", "a/b", "a:b", "a\ncontrol"})
  void rechazaRequestIdNoCanonico(String requestId) {
    assertThatThrownBy(
            () ->
                FinancialPlan.parseFinancialPlan(
                    json(
                        Map.of(
                            "actions",
                            List.of(
                                Map.of(
                                    "domain", "meta", "operation", "consultar", "payload",
                                    Map.of())))),
                    requestId))
        .isInstanceOf(InvalidPlanException.class);
  }

  @ParameterizedTest
  @ValueSource(strings = {" goal_1", "goal/1", "goal\u0000"})
  void rechazaResourceIdNoCanonico(String resourceId) {
    assertThatThrownBy(
            () ->
                parseActions(
                    Map.of(
                        "domain", "meta",
                        "operation", "eliminar",
                        "resourceId", resourceId,
                        "payload", Map.of())))
        .isInstanceOf(InvalidPlanException.class);
  }

  @Test
  void limitaNeedsInputANombresUnicosYAdmisiblesParaLaVariante() {
    assertThatThrownBy(() -> parseActions(metaConsultar(List.of("resourceId", "resourceId"))))
        .isInstanceOf(InvalidPlanException.class);
    assertThatThrownBy(() -> parseActions(metaConsultar(List.of("monto"))))
        .isInstanceOf(InvalidPlanException.class);
    assertThatThrownBy(
            () ->
                parseActions(
                    Map.of(
                        "domain", "movimiento",
                        "operation", "crear",
                        "payload", GASTO,
                        "needsInput",
                            List.of(
                                "tipo", "monto", "descripcion", "categoria", "fecha", "goalId"))))
        .isInstanceOf(InvalidPlanException.class);
  }

  private static Map<String, Object> metaConsultar(List<String> needsInput) {
    return Map.of(
        "domain", "meta", "operation", "consultar", "payload", Map.of(), "needsInput", needsInput);
  }

  static Stream<Map<String, Object>> accionesSinResourceId() {
    return Stream.of(
        Map.of("domain", "ahorro", "operation", "editar", "payload", Map.of("amount", 1)),
        Map.of("domain", "ahorro", "operation", "eliminar", "payload", Map.of()),
        Map.of("domain", "meta", "operation", "editar", "payload", Map.of("title", "Bici")),
        Map.of("domain", "meta", "operation", "eliminar", "payload", Map.of()));
  }

  @ParameterizedTest
  @MethodSource("accionesSinResourceId")
  void exigeResourceId(Map<String, Object> action) {
    assertThatThrownBy(() -> parseActions(action)).isInstanceOf(InvalidPlanException.class);
  }

  @Test
  void aceptaUnaMetaIncompletaCuandoDeclaraElDatoFaltanteEnNeedsInput() {
    FinancialPlan.Action action =
        parseActions(
                Map.of(
                    "domain", "meta",
                    "operation", "crear",
                    "payload", Map.of("title", "Bici", "iconId", "bike", "category", "custom"),
                    "needsInput", List.of("targetAmount")))
            .actions()
            .get(0);

    assertThat(action.domain()).isEqualTo("meta");
    assertThat(action.operation()).isEqualTo("crear");
    assertThat(action.payload().get("title").stringValue()).isEqualTo("Bici");
    assertThat(action.needsInput()).containsExactly("targetAmount");
  }

  static Stream<Map<String, Object>> faltantesNoDeclarados() {
    return Stream.of(
        Map.of(
            "domain", "meta",
            "operation", "crear",
            "payload", Map.of("title", "Bici", "iconId", "bike", "category", "custom"),
            "needsInput", List.of()),
        Map.of(
            "domain", "meta",
            "operation", "editar",
            "payload", Map.of("title", "Bici"),
            "needsInput", List.of()),
        Map.of("domain", "meta", "operation", "eliminar", "payload", Map.of(), "needsInput", List.of()));
  }

  @ParameterizedTest
  @MethodSource("faltantesNoDeclarados")
  void rechazaFaltantesQueNoEstenDeclaradosEnNeedsInput(Map<String, Object> action) {
    assertThatThrownBy(() -> parseActions(action)).isInstanceOf(InvalidPlanException.class);
  }

  @ParameterizedTest
  @ValueSource(strings = {"editar", "eliminar"})
  void aceptaMetaSinResourceIdSiNeedsInputLoSolicita(String operation) {
    FinancialPlan.Action action =
        parseActions(
                Map.of(
                    "domain", "meta",
                    "operation", operation,
                    "payload", operation.equals("editar") ? Map.of("title", "Bici") : Map.of(),
                    "needsInput", List.of("resourceId")))
            .actions()
            .get(0);

    assertThat(action.operation()).isEqualTo(operation);
    assertThat(action.needsInput()).containsExactly("resourceId");
    assertThat(Js.MAPPER.valueToTree(action).has("resourceId")).isFalse();
  }

  static Stream<Map<String, Object>> needsInputPresentes() {
    return Stream.of(
        Map.of(
            "domain", "meta",
            "operation", "editar",
            "payload", Map.of(),
            "needsInput", List.of("resourceId")),
        Map.of(
            "domain", "meta",
            "operation", "crear",
            "payload",
                Map.of("title", "Bici", "iconId", "bike", "category", "custom", "targetAmount", 1),
            "needsInput", List.of("targetAmount")),
        Map.of(
            "domain", "meta",
            "operation", "editar",
            "resourceId", "goal_1",
            "payload", Map.of("title", "Bici"),
            "needsInput", List.of("resourceId")));
  }

  @ParameterizedTest
  @MethodSource("needsInputPresentes")
  void rechazaNeedsInputQueNoCorrespondeAUnDatoAusente(Map<String, Object> action) {
    assertThatThrownBy(() -> parseActions(action)).isInstanceOf(InvalidPlanException.class);
  }
}
