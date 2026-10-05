package co.ceti.content;

import co.ceti.shared.ApiException;
import co.ceti.tenancy.CursoAccess;
import co.ceti.users.User;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Config de clase (D-ORQ, RQ-PR10) y contenido copy-on-write por curso (RQ-PR11/PR12). Lo escribe
 * solo el profesor del curso; lo lee el curso. Los bancos globales nunca se mutan (R8).
 */
@RestController
@RequestMapping("/api/colegios/{cid}/cursos/{cursoId}")
public class CursoContentController {

  /** Escritura atómica contenido + config: nunca queda un estado mixto (flag sin copia o viceversa). */
  public record Batch(
      JsonNode config, Map<String, JsonNode> set, List<String> delete) {}

  private final JdbcClient jdbc;
  private final JsonMapper json;
  private final CursoAccess access;

  public CursoContentController(JdbcClient jdbc, JsonMapper json, CursoAccess access) {
    this.jdbc = jdbc;
    this.json = json;
    this.access = access;
  }

  @GetMapping("/config")
  public JsonNode getConfig(User u, @PathVariable String cid, @PathVariable String cursoId) {
    access.requireMiembro(u, cid, cursoId);
    return jdbc.sql("select data from curso_config where colegio_id = ? and curso_id = ?")
        .params(cid, cursoId)
        .query(String.class)
        .optional()
        .map(json::readTree)
        .orElseThrow(() -> ApiException.notFound("Sin configuración (defaults)."));
  }

  @PutMapping("/config")
  @Transactional
  public JsonNode putConfig(User u, @PathVariable String cid, @PathVariable String cursoId, @RequestBody JsonNode config) {
    access.requireProfesorDe(u, cid, cursoId);
    ContentRules.validateConfig(config, u.id());
    upsertConfig(cid, cursoId, config);
    return config;
  }

  /** "Restaurar configuración": sin fila = defaults. */
  @DeleteMapping("/config")
  public ResponseEntity<Void> deleteConfig(User u, @PathVariable String cid, @PathVariable String cursoId) {
    access.requireProfesorDe(u, cid, cursoId);
    jdbc.sql("delete from curso_config where colegio_id = ? and curso_id = ?").params(cid, cursoId).update();
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/contenido/{docId}")
  public JsonNode getContenido(User u, @PathVariable String cid, @PathVariable String cursoId, @PathVariable String docId) {
    access.requireMiembro(u, cid, cursoId);
    return jdbc.sql("select data from curso_contenido where colegio_id = ? and curso_id = ? and doc_id = ?")
        .params(cid, cursoId, docId)
        .query(String.class)
        .optional()
        .map(json::readTree)
        .orElseThrow(() -> ApiException.notFound("Sin contenido propio."));
  }

  @PostMapping("/contenido/batch")
  @Transactional
  public ResponseEntity<Void> batch(User u, @PathVariable String cid, @PathVariable String cursoId, @RequestBody Batch body) {
    access.requireProfesorDe(u, cid, cursoId);
    Map<String, JsonNode> set = body.set() == null ? Map.of() : body.set();
    List<String> delete = body.delete() == null ? List.of() : body.delete();
    if (set.size() > 10 || delete.size() > 10) throw ApiException.badRequest("Demasiadas piezas en un lote.");
    set.forEach((docId, doc) -> {
      ContentRules.validateDocId(docId);
      ContentRules.validateContenido(docId, doc);
    });
    delete.forEach(ContentRules::validateDocId);
    if (body.config() != null) ContentRules.validateConfig(body.config(), u.id());

    for (String docId : delete) {
      jdbc.sql("delete from curso_contenido where colegio_id = ? and curso_id = ? and doc_id = ?")
          .params(cid, cursoId, docId)
          .update();
    }
    set.forEach((docId, doc) ->
        jdbc.sql(
                """
                insert into curso_contenido (colegio_id, curso_id, doc_id, data) values (?, ?, ?, cast(? as jsonb))
                on conflict (colegio_id, curso_id, doc_id) do update set data = excluded.data
                """)
            .params(cid, cursoId, docId, json.writeValueAsString(doc))
            .update());
    if (body.config() != null) upsertConfig(cid, cursoId, body.config());
    return ResponseEntity.noContent().build();
  }

  private void upsertConfig(String cid, String cursoId, JsonNode config) {
    jdbc.sql(
            """
            insert into curso_config (colegio_id, curso_id, data) values (?, ?, cast(? as jsonb))
            on conflict (colegio_id, curso_id) do update set data = excluded.data
            """)
        .params(cid, cursoId, json.writeValueAsString(config))
        .update();
  }
}
