package co.ceti.ia;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Plan de acciones financieras propuesto por el modelo. {@link #parseFinancialPlan} lo valida como
 * entrada no confiable: payloads cerrados, enums, límites y needsInput coherente.
 */
public record FinancialPlan(List<Action> actions) {

  public static final List<String> MOVIMIENTO_CATEGORIAS =
      List.of(
          "comida",
          "transporte",
          "entretenimiento",
          "ropa",
          "educacion",
          "tecnologia",
          "regalos",
          "otros");

  private static final List<String> GOAL_ICON_IDS =
      List.of("bike", "book", "laptop", "plane", "shield", "target");
  private static final List<String> GOAL_CATEGORIES =
      List.of("electronics", "toy", "trip", "education", "emergency", "custom");
  private static final Pattern ID = Pattern.compile("[A-Za-z0-9_-]+");

  /** {@code resourceId} se omite del JSON cuando falta (lo pide needsInput o no aplica). */
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record Action(
      String actionId,
      String domain,
      String operation,
      String resourceId,
      ObjectNode payload,
      List<String> needsInput) {}

  public static class InvalidPlanException extends RuntimeException {
    public InvalidPlanException(String message) {
      super(message);
    }
  }

  /**
   * Reglas por dominio. Las consultas de meta no tienen filtros pero admiten resourceId (filtrar por
   * una meta); las de movimiento y ahorro no.
   */
  private record DomainRules(
      Map<String, Predicate<JsonNode>> queryFields,
      List<String> queryNeeds,
      boolean queryAcceptsResourceId,
      String queryError,
      Map<String, Predicate<JsonNode>> changeFields,
      List<String> requiredForCreate,
      String changeError) {}

  private static final Map<String, DomainRules> RULES =
      Map.of(
          "movimiento",
          new DomainRules(
              Map.of(
                  "desde", FinancialPlan::isTimestamp,
                  "hasta", FinancialPlan::isTimestamp,
                  "tipo", oneOf(List.of("gasto", "ahorro"))),
              List.of("desde", "hasta", "tipo"),
              false,
              "Consulta de movimientos inválida.",
              Map.of(
                  "tipo", oneOf(List.of("gasto", "ahorro")),
                  "monto", FinancialPlan::isMoney,
                  "descripcion", FinancialPlan::isText,
                  "categoria", oneOf(MOVIMIENTO_CATEGORIAS),
                  "fecha", FinancialPlan::isTimestamp,
                  "goalId", FinancialPlan::isId),
              List.of("tipo", "monto", "descripcion", "categoria", "fecha"),
              "Payload de movimiento inválido."),
          "ahorro",
          new DomainRules(
              Map.of(
                  "desde", FinancialPlan::isTimestamp,
                  "hasta", FinancialPlan::isTimestamp,
                  "goalId", FinancialPlan::isId,
                  "type", oneOf(List.of("aporte", "retiro"))),
              List.of("desde", "hasta", "goalId", "type"),
              false,
              "Consulta de ahorros inválida.",
              Map.of(
                  "type", oneOf(List.of("aporte", "retiro")),
                  "amount", FinancialPlan::isMoney,
                  "description", FinancialPlan::isText,
                  "goalId", FinancialPlan::isId,
                  "fecha", FinancialPlan::isTimestamp),
              List.of("type", "amount", "description", "fecha"),
              "Payload de ahorro inválido."),
          "meta",
          new DomainRules(
              Map.of(),
              List.of("resourceId"),
              true,
              "", // sin filtros: la validación de consulta no puede fallar
              Map.of(
                  "title", FinancialPlan::isText,
                  "iconId", oneOf(GOAL_ICON_IDS),
                  "category", oneOf(GOAL_CATEGORIES),
                  "targetAmount", FinancialPlan::isMoney,
                  "deadline", FinancialPlan::isTimestamp),
              List.of("title", "iconId", "category", "targetAmount"),
              "Payload de meta inválido."));

  private static final Set<String> OPERATIONS = Set.of("consultar", "crear", "editar", "eliminar");

  public static FinancialPlan parseFinancialPlan(String raw, String requestId) {
    if (!isId(requestId)) invalid("requestId inválido.");
    JsonNode decoded =
        Js.parseJson(raw)
            .orElseThrow(() -> new InvalidPlanException("La respuesta no contiene JSON válido."));
    ObjectNode plan = requireObject(decoded, "El plan");
    requireOnly(plan, Set.of("actions"), "El plan");
    JsonNode actions = plan.get("actions");
    if (actions == null || !actions.isArray() || actions.size() < 1 || actions.size() > 5) {
      invalid("El plan debe contener entre una y cinco acciones.");
    }
    List<Action> parsed = new ArrayList<>();
    for (int index = 0; index < actions.size(); index++) {
      parsed.add(parseAction(actions.get(index), requestId + ":" + index));
    }
    return new FinancialPlan(List.copyOf(parsed));
  }

  private static Action parseAction(JsonNode value, String actionId) {
    ObjectNode action = requireObject(value, "La acción");
    requireOnly(
        action, Set.of("domain", "operation", "resourceId", "payload", "needsInput"), "La acción");
    JsonNode domainNode = action.get("domain");
    DomainRules rules =
        domainNode != null && domainNode.isString() ? RULES.get(domainNode.stringValue()) : null;
    if (rules == null) invalid("Dominio inválido.");
    JsonNode operationNode = action.get("operation");
    if (operationNode == null
        || !operationNode.isString()
        || !OPERATIONS.contains(operationNode.stringValue())) {
      invalid("Operación inválida.");
    }
    String domain = domainNode.stringValue();
    String operation = operationNode.stringValue();
    JsonNode resourceIdNode = action.get("resourceId");
    if (resourceIdNode != null && !isId(resourceIdNode)) invalid("resourceId inválido.");
    String resourceId = resourceIdNode == null ? null : resourceIdNode.stringValue();

    ObjectNode payload = requireObject(action.get("payload"), "payload");
    JsonNode rawNeeds = action.get("needsInput");

    if (operation.equals("consultar")) {
      if (resourceId != null && !rules.queryAcceptsResourceId()) {
        invalid("La consulta no admite resourceId.");
      }
      validateQuery(payload, rules);
      List<String> needsInput = validateNeedsInput(rawNeeds, rules.queryNeeds());
      validateNeedsAreMissing(needsInput, payload, resourceId);
      return new Action(actionId, domain, operation, resourceId, payload, needsInput);
    }
    if (operation.equals("crear")) {
      if (resourceId != null) invalid("La creación no admite resourceId.");
      List<String> needsInput = validateNeedsInput(rawNeeds, rules.changeFields().keySet());
      validateNeedsAreMissing(needsInput, payload, resourceId);
      validateChanges(operation, payload, needsInput, rules);
      return new Action(actionId, domain, operation, null, payload, needsInput);
    }
    List<String> allowedNeeds = new ArrayList<>(List.of("resourceId"));
    if (operation.equals("editar")) allowedNeeds.addAll(rules.changeFields().keySet());
    List<String> needsInput = validateNeedsInput(rawNeeds, allowedNeeds);
    validateNeedsAreMissing(needsInput, payload, resourceId);
    if (resourceId == null && !needsInput.contains("resourceId")) {
      invalid("La operación requiere resourceId.");
    }
    if (operation.equals("editar")) validateChanges(operation, payload, needsInput, rules);
    else requireOnly(payload, Set.of(), "payload");
    return new Action(actionId, domain, operation, resourceId, payload, needsInput);
  }

  private static void validateQuery(ObjectNode payload, DomainRules rules) {
    requireOnly(payload, rules.queryFields().keySet(), "payload");
    if (!fieldsAreValid(payload, rules.queryFields())) invalid(rules.queryError());
    JsonNode desde = payload.get("desde");
    JsonNode hasta = payload.get("hasta");
    if (desde != null && hasta != null && desde.doubleValue() > hasta.doubleValue()) {
      invalid("El rango de fechas es inválido.");
    }
  }

  private static void validateChanges(
      String operation, ObjectNode payload, List<String> needsInput, DomainRules rules) {
    requireOnly(payload, rules.changeFields().keySet(), "payload");
    boolean requiredForCreate =
        !operation.equals("crear")
            || rules.requiredForCreate().stream()
                .allMatch(field -> payload.get(field) != null || needsInput.contains(field));
    boolean emptyEdit =
        operation.equals("editar")
            && payload.isEmpty()
            && needsInput.stream().allMatch(field -> field.equals("resourceId"));
    if (!fieldsAreValid(payload, rules.changeFields()) || !requiredForCreate || emptyEdit) {
      invalid(rules.changeError());
    }
  }

  private static boolean fieldsAreValid(
      ObjectNode payload, Map<String, Predicate<JsonNode>> fields) {
    return fields.entrySet().stream()
        .allMatch(
            field -> {
              JsonNode value = payload.get(field.getKey());
              return value == null || field.getValue().test(value);
            });
  }

  private static List<String> validateNeedsInput(JsonNode value, Collection<String> allowed) {
    if (value == null) return List.of();
    if (!value.isArray() || value.size() > 5) invalid("needsInput es inválido.");
    List<String> needs = new ArrayList<>();
    for (JsonNode item : value) {
      if (!item.isString() || !allowed.contains(item.stringValue())) {
        invalid("needsInput es inválido.");
      }
      needs.add(item.stringValue());
    }
    if (new HashSet<>(needs).size() != needs.size()) invalid("needsInput es inválido.");
    return List.copyOf(needs);
  }

  private static void validateNeedsAreMissing(
      List<String> needsInput, ObjectNode payload, String resourceId) {
    boolean present =
        needsInput.stream()
            .anyMatch(
                field ->
                    field.equals("resourceId") ? resourceId != null : payload.get(field) != null);
    if (present) invalid("needsInput debe contener únicamente campos ausentes.");
  }

  private static ObjectNode requireObject(JsonNode value, String name) {
    if (value == null || !value.isObject()) invalid(name + " debe ser un objeto.");
    return (ObjectNode) value;
  }

  private static void requireOnly(ObjectNode value, Set<String> allowed, String name) {
    if (!allowed.containsAll(value.propertyNames())) {
      invalid(name + " contiene campos adicionales.");
    }
  }

  private static Predicate<JsonNode> oneOf(List<String> values) {
    return value -> value.isString() && values.contains(value.stringValue());
  }

  private static void invalid(String message) {
    throw new InvalidPlanException(message);
  }

  // Predicados compartidos con FinancialAssistant (mismas reglas para contexto y plan).

  static boolean isId(String value) {
    return value.length() <= 140 && ID.matcher(value).matches();
  }

  static boolean isId(JsonNode value) {
    return value != null && value.isString() && isId(value.stringValue());
  }

  static boolean isText(JsonNode value) {
    return value != null
        && value.isString()
        && !Js.trim(value.stringValue()).isEmpty()
        && value.stringValue().length() <= 140;
  }

  static boolean isMoney(JsonNode value) {
    return isInteger(value) && value.doubleValue() >= 1 && value.doubleValue() <= 100_000_000;
  }

  // El tope (máximo de Date) es menor que MAX_SAFE_INTEGER, así que también cubre isSafeInteger.
  static boolean isTimestamp(JsonNode value) {
    return isInteger(value)
        && value.doubleValue() >= 0
        && value.doubleValue() <= 8_640_000_000_000_000d;
  }

  // Number.isInteger: en JS 1.0 o 1e3 también son enteros.
  private static boolean isInteger(JsonNode value) {
    if (value == null || !value.isNumber()) return false;
    double number = value.doubleValue();
    return Double.isFinite(number) && number == Math.rint(number);
  }
}
