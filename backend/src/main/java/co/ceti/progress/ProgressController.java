package co.ceti.progress;

import co.ceti.progress.Agregados.ProgressRow;
import co.ceti.shared.ApiException;
import co.ceti.tenancy.CursoAccess;
import co.ceti.users.User;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@RestController
@RequestMapping("/api/colegios/{cid}/cursos/{cursoId}")
public class ProgressController {

  private final JdbcClient jdbc;
  private final JsonMapper json;
  private final CursoAccess access;

  public ProgressController(JdbcClient jdbc, JsonMapper json, CursoAccess access) {
    this.jdbc = jdbc;
    this.json = json;
    this.access = access;
  }

  @GetMapping("/estudiantes/{uid}/progress")
  public List<JsonNode> list(User u, @PathVariable String cid, @PathVariable String cursoId, @PathVariable String uid) {
    boolean self = u.id().equals(uid) && access.isEstudianteActivoEn(u, cid, cursoId);
    if (!self) access.requireProfesorDe(u, cid, cursoId);
    return jdbc.sql("select world_id, data from progress where colegio_id = ? and curso_id = ? and uid = ?")
        .params(cid, cursoId, uid)
        .query((rs, i) -> (JsonNode) ((ObjectNode) json.readTree(rs.getString("data"))).put("worldId", rs.getString("world_id")))
        .list();
  }

  /**
   * Solo el estudiante escribe SU progreso, solo mientras está activo y bajo su curso. Las claves
   * denormalizadas deben coincidir con la ruta; el progreso alimenta el reporte del profesor.
   */
  @PutMapping("/estudiantes/{uid}/progress/{worldId}")
  public ResponseEntity<Void> upsert(
      User u, @PathVariable String cid, @PathVariable String cursoId, @PathVariable String uid,
      @PathVariable String worldId, @RequestBody JsonNode p) {
    if (!u.id().equals(uid) || !access.isEstudianteActivoEn(u, cid, cursoId)) {
      throw ApiException.forbidden("Solo el estudiante activo escribe su progreso.");
    }
    boolean valid = p.isObject()
        && cid.equals(p.path("colegioId").asString(null))
        && cursoId.equals(p.path("cursoId").asString(null))
        && uid.equals(p.path("uid").asString(null))
        && p.path("competencia").isString()
        && p.path("mastery").isNumber() && p.get("mastery").asDouble() >= 0 && p.get("mastery").asDouble() <= 1
        && p.path("completed").isBoolean()
        && p.path("updatedAt").isNumber()
        && worldId.length() <= 100;
    if (!valid) throw ApiException.badRequest("Progreso inválido.");
    // Merge como el setDoc(merge:true) anterior: campos previos no enviados se conservan.
    jdbc.sql(
            """
            insert into progress (colegio_id, curso_id, uid, world_id, data) values (?, ?, ?, ?, cast(? as jsonb))
            on conflict (colegio_id, curso_id, uid, world_id) do update set data = progress.data || excluded.data
            """)
        .params(cid, cursoId, uid, worldId, json.writeValueAsString(p))
        .update();
    return ResponseEntity.noContent().build();
  }

  /** Agregado no nominal: cualquier profesor del colegio (reporte institucional). */
  @GetMapping("/agregado")
  public ResponseEntity<Agregados.Resumen> agregado(User u, @PathVariable String cid, @PathVariable String cursoId) {
    if (!u.isProfesor() || !u.inColegio(cid)) throw ApiException.forbidden("Solo profesores del colegio.");
    List<ProgressRow> rows = jdbc.sql("select uid, world_id, data from progress where colegio_id = ? and curso_id = ?")
        .params(cid, cursoId)
        .query((rs, i) -> new ProgressRow(rs.getString("uid"), rs.getString("world_id"), json.readTree(rs.getString("data"))))
        .list();
    Agregados.Resumen resumen = Agregados.resumen(cid, cursoId, rows, System.currentTimeMillis());
    return resumen == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(resumen);
  }
}
