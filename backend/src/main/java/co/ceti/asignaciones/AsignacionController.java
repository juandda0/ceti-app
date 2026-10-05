package co.ceti.asignaciones;

import co.ceti.shared.ApiException;
import co.ceti.tenancy.CursoAccess;
import co.ceti.users.User;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/** Asignaciones: brief de mundo (RQ-PR04) o reto financiero (RQ-PR14). El profesor crea; el curso lee. */
@RestController
@RequestMapping("/api/colegios/{cid}")
public class AsignacionController {

  private static final Set<String> KEYS = Set.of("kind", "worldId", "reto", "target", "fechaInicio", "deadline", "createdByUid", "createdAt");
  // v1: solo los dos tipos de reto que menos revelan (el resto, tras la firma de compliance).
  private static final Set<String> RETO_TIPOS = Set.of("registrar_movimientos", "crear_meta");

  private final JdbcClient jdbc;
  private final JsonMapper json;
  private final CursoAccess access;

  public AsignacionController(JdbcClient jdbc, JsonMapper json, CursoAccess access) {
    this.jdbc = jdbc;
    this.json = json;
    this.access = access;
  }

  @PostMapping("/asignaciones")
  public Map<String, String> create(User u, @PathVariable String cid, @RequestBody JsonNode a) {
    String cursoId = a.path("target").path("cursoId").asString(null);
    if (cursoId == null) throw ApiException.badRequest("target.cursoId requerido.");
    access.requireProfesorDe(u, cid, cursoId);
    if (!shapeValida(a, u.id())) throw ApiException.badRequest("Asignación inválida.");
    String id = UUID.randomUUID().toString();
    String targetUid = "estudiante".equals(a.get("target").get("tipo").asString()) ? a.get("target").get("uid").asString() : null;
    jdbc.sql("insert into asignaciones (id, colegio_id, curso_id, target_uid, data) values (?, ?, ?, ?, cast(? as jsonb))")
        .params(id, cid, cursoId, targetUid, json.writeValueAsString(a))
        .update();
    return Map.of("id", id);
  }

  /** Profesor: todas las del curso. Estudiante activo: las del curso + las dirigidas a él. */
  @GetMapping("/cursos/{cursoId}/asignaciones")
  public List<JsonNode> list(User u, @PathVariable String cid, @PathVariable String cursoId) {
    String sql;
    List<Object> params;
    if (access.isProfesorDe(u, cid, cursoId)) {
      sql = "select id, data from asignaciones where colegio_id = ? and curso_id = ?";
      params = List.of(cid, cursoId);
    } else if (access.isEstudianteActivoEn(u, cid, cursoId)) {
      sql = "select id, data from asignaciones where colegio_id = ? and curso_id = ? and (target_uid is null or target_uid = ?)";
      params = List.of(cid, cursoId, u.id());
    } else {
      throw ApiException.forbidden("Sin acceso a este curso.");
    }
    return jdbc.sql(sql)
        .params(params)
        .query((rs, i) -> (JsonNode) ((ObjectNode) json.readTree(rs.getString("data"))).put("id", rs.getString("id")))
        .list();
  }

  /** Port de asignacionShapeValida: un reto no puede colar texto libre ni montos. */
  static boolean shapeValida(JsonNode d, String callerUid) {
    if (!d.isObject() || !keysOnly(d, KEYS)) return false;
    JsonNode t = d.path("target");
    if (!t.isObject() || !keysOnly(t, Set.of("tipo", "cursoId", "uid")) || !t.path("cursoId").isString()) return false;
    String tipo = t.path("tipo").asString("");
    boolean targetOk = switch (tipo) {
      case "curso" -> !t.has("uid");
      case "estudiante" -> t.path("uid").isString();
      default -> false;
    };
    if (!targetOk) return false;
    if (!d.path("fechaInicio").isNumber() || !d.path("deadline").isNumber() || !d.path("createdAt").isNumber()) return false;
    if (d.get("deadline").asDouble() <= d.get("fechaInicio").asDouble()) return false;
    if (!callerUid.equals(d.path("createdByUid").asString(null))) return false;

    String kind = d.has("kind") ? d.get("kind").asString("") : "mundo";
    if ("mundo".equals(kind)) return d.path("worldId").isString() && !d.has("reto");
    if (!"reto".equals(kind) || d.has("worldId")) return false;
    JsonNode reto = d.path("reto");
    return reto.isObject()
        && keysOnly(reto, Set.of("tipo", "cantidad"))
        && RETO_TIPOS.contains(reto.path("tipo").asString(""))
        && reto.path("cantidad").isIntegralNumber()
        && reto.get("cantidad").asInt() >= 1
        && reto.get("cantidad").asInt() <= 100;
  }

  private static boolean keysOnly(JsonNode d, Set<String> allowed) {
    return allowed.containsAll(new HashSet<>(d.propertyNames()));
  }
}
