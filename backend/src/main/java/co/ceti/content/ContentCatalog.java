package co.ceti.content;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Bancos globales (R8): contenido curado, de solo lectura, versionado en el repo (content/). Se
 * empaqueta en el jar y vive en memoria: no hay BD ni seed que pueda quedar desincronizado.
 * Quiz y EligeCamino pasan por el gate (content/approved/ son los manifiestos aprobados);
 * micro-teoría no.
 */
@Component
public class ContentCatalog {

  private static final Logger log = LoggerFactory.getLogger(ContentCatalog.class);
  private static final Pattern QUIZ = Pattern.compile("^\\d+_world_\\d+_(multiple_choice|true_false|ordenar)$");
  private static final Pattern ELIGE = Pattern.compile("^\\d+_world_\\d+$");

  private final Map<String, JsonNode> bancos = new HashMap<>();
  private final Map<String, JsonNode> eligeCamino = new HashMap<>();
  private final Map<String, JsonNode> microteoria = new HashMap<>();

  public ContentCatalog(JsonMapper json) throws IOException {
    var resolver = new PathMatchingResourcePatternResolver();
    for (Resource manifestFile : resolver.getResources("classpath*:content/approved/*.json")) {
      JsonNode manifest = read(json, manifestFile);
      String bancoId = text(manifest, "bancoId", stripJson(manifestFile.getFilename()));
      String source = text(manifest, "approvedFrom", bancoId + ".json");
      Resource bankFile = resolver.getResource("classpath:content/bancos/" + source);
      if (!bankFile.exists()) {
        log.warn("Banco aprobado sin contenido en disco: {}", bancoId);
        continue;
      }
      ObjectNode bank = (ObjectNode) read(json, bankFile);
      bank.put("bancoId", bancoId);
      if (!bank.has("pendiente_validacion_docente")) bank.put("pendiente_validacion_docente", true);
      if (QUIZ.matcher(bancoId).matches()) {
        if (!bank.has("version")) bank.put("version", 1);
        if (!bank.has("generadoPor")) bank.put("generadoPor", "ia");
        bancos.put(bancoId, bank);
      } else if (ELIGE.matcher(bancoId).matches()) {
        eligeCamino.put(bancoId, bank);
      }
    }
    for (Resource file : resolver.getResources("classpath*:content/microteoria/*.json")) {
      ObjectNode bank = (ObjectNode) read(json, file);
      String id = bank.has("grado") && bank.has("worldId")
          ? bank.get("grado").asString() + "_" + bank.get("worldId").asString()
          : stripJson(file.getFilename());
      if (!bank.has("generadoPor")) bank.put("generadoPor", "ia");
      if (!bank.has("pendiente_validacion_docente")) bank.put("pendiente_validacion_docente", true);
      microteoria.put(id, bank);
    }
    log.info("Contenido cargado: {} bancos, {} elige-camino, {} micro-teorías", bancos.size(), eligeCamino.size(), microteoria.size());
  }

  public Optional<JsonNode> banco(String id) {
    return Optional.ofNullable(bancos.get(id));
  }

  public Optional<JsonNode> eligeCamino(String id) {
    return Optional.ofNullable(eligeCamino.get(id));
  }

  public Optional<JsonNode> microteoria(String id) {
    return Optional.ofNullable(microteoria.get(id));
  }

  private static JsonNode read(JsonMapper json, Resource r) throws IOException {
    try (InputStream in = r.getInputStream()) {
      return json.readTree(in);
    }
  }

  private static String text(JsonNode node, String field, String fallback) {
    JsonNode v = node.get(field);
    return v != null && v.isString() ? v.asString() : fallback;
  }

  private static String stripJson(String filename) {
    return filename == null ? "" : filename.replaceFirst("\\.json$", "");
  }
}
