package co.ceti.content;

import co.ceti.shared.ApiException;
import java.util.HashSet;
import java.util.Set;
import tools.jackson.databind.JsonNode;

/**
 * Validación de forma que hacían firestore.rules para la config de clase y el contenido por curso.
 * La validación profunda de cada ítem sigue en el cliente (Zod); aquí: campos permitidos, tipos y
 * topes de tamaño, para que nadie meta basura ni documentos gigantes.
 */
final class ContentRules {

  private static final Set<String> CONFIG_KEYS = Set.of("mundos", "overrides", "version", "updatedAt", "updatedByUid");
  private static final Set<String> BANCO_KEYS = Set.of(
      "bancoId", "grado", "worldId", "tipo", "version", "generadoPor", "pendiente_validacion_docente", "items");
  private static final Set<String> MICRO_KEYS = Set.of("grado", "worldId", "cards", "generadoPor", "pendiente_validacion_docente");
  private static final Set<String> ELIGE_KEYS = Set.of(
      "bancoId", "grado", "worldId", "situaciones", "generadoPor", "pendiente_validacion_docente");

  private ContentRules() {}

  static void validateConfig(JsonNode d, String callerUid) {
    require(d != null && d.isObject() && keysOnly(d, CONFIG_KEYS), "config: campos no permitidos");
    JsonNode mundos = d.get("mundos");
    require(mundos != null && mundos.isArray() && mundos.size() >= 1 && mundos.size() <= 30, "config.mundos: 1..30");
    require(!d.has("overrides") || d.get("overrides").isObject(), "config.overrides: debe ser un mapa");
    require(isNumber(d, "version") && isNumber(d, "updatedAt"), "config: version/updatedAt numéricos");
    require(d.has("updatedByUid") && callerUid.equals(d.get("updatedByUid").asString()), "config.updatedByUid: debe ser el autor");
  }

  static void validateContenido(String docId, JsonNode d) {
    require(d != null && d.isObject(), "contenido: debe ser un objeto");
    if (docId.startsWith("banco_")) {
      require(keysOnly(d, BANCO_KEYS) && listSize(d, "items", 1, 100), "banco: forma inválida");
    } else if (docId.startsWith("microteoria_")) {
      require(keysOnly(d, MICRO_KEYS) && listSize(d, "cards", 1, 20), "microteoria: forma inválida");
    } else if (docId.startsWith("eligeCamino_")) {
      require(keysOnly(d, ELIGE_KEYS) && listSize(d, "situaciones", 1, 30), "eligeCamino: forma inválida");
    } else {
      throw ApiException.badRequest("docId de contenido no reconocido.");
    }
  }

  static void validateDocId(String docId) {
    require(docId.matches("(banco|microteoria|eligeCamino)_[A-Za-z0-9_]{1,100}"), "docId de contenido no reconocido");
  }

  private static boolean keysOnly(JsonNode d, Set<String> allowed) {
    Set<String> keys = new HashSet<>(d.propertyNames());
    return allowed.containsAll(keys);
  }

  private static boolean listSize(JsonNode d, String field, int min, int max) {
    JsonNode list = d.get(field);
    return list != null && list.isArray() && list.size() >= min && list.size() <= max;
  }

  private static boolean isNumber(JsonNode d, String field) {
    return d.has(field) && d.get(field).isNumber();
  }

  private static void require(boolean ok, String message) {
    if (!ok) throw ApiException.badRequest(message);
  }
}
