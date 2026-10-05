package co.ceti.finanzas;

import co.ceti.finanzas.FinanzasDocs.Goal;
import co.ceti.finanzas.FinanzasDocs.Movimiento;
import co.ceti.finanzas.FinanzasDocs.Operation;
import co.ceti.finanzas.FinanzasDocs.Presupuestos;
import co.ceti.shared.ApiException;
import co.ceti.users.User;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Optional;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Metas, operaciones, diario de bolsillo y presupuestos de la cuenta. Self-only por diseño: NINGÚN
 * rol de staff (ni admin) lee los movimientos individuales de un estudiante (CA5) — por eso todo
 * cuelga de /api/me y el dueño sale del token, nunca de la URL.
 */
@RestController
@RequestMapping("/api/me")
public class FinanzasController {

  public record Finanzas(List<JsonNode> goals, List<JsonNode> deposits, List<JsonNode> movimientos, JsonNode presupuestos) {}

  private static final String PRESUPUESTOS_ID = "presupuestos";

  private final JdbcClient jdbc;
  private final JsonMapper json;

  public FinanzasController(JdbcClient jdbc, JsonMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  @GetMapping("/finanzas")
  public Finanzas finanzas(User u) {
    return new Finanzas(
        all(u, "goals"), all(u, "deposits"), all(u, "movimientos"),
        find(u, "presupuestos", PRESUPUESTOS_ID).orElse(null));
  }

  /** Sin DELETE: las metas se borran en blando (deletedAt). */
  @PutMapping("/goals/{id}")
  @Transactional
  public ResponseEntity<Void> putGoal(User u, @PathVariable String id, @Valid @RequestBody Goal g) {
    requireSameId(id, g.id());
    find(u, "goals", id).ifPresent(prev -> requireUnchanged(prev, g, "createdAt"));
    save(u, "goals", id, g);
    return ResponseEntity.noContent().build();
  }

  @PutMapping("/deposits/{id}")
  @Transactional
  public ResponseEntity<Void> putDeposit(User u, @PathVariable String id, @Valid @RequestBody Operation op) {
    requireSameId(id, op.id());
    find(u, "deposits", id).ifPresent(prev -> requireUnchanged(prev, op, "type", "createdAt"));
    save(u, "deposits", id, op);
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/deposits/{id}")
  public ResponseEntity<Void> deleteDeposit(User u, @PathVariable String id) {
    return delete(u, "deposits", id);
  }

  @PutMapping("/movimientos/{id}")
  @Transactional
  public ResponseEntity<Void> putMovimiento(User u, @PathVariable String id, @Valid @RequestBody Movimiento m) {
    requireSameId(id, m.id());
    find(u, "movimientos", id).ifPresent(prev -> requireUnchanged(prev, m, "tipo", "createdAt"));
    save(u, "movimientos", id, m);
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/movimientos/{id}")
  public ResponseEntity<Void> deleteMovimiento(User u, @PathVariable String id) {
    return delete(u, "movimientos", id);
  }

  @PutMapping("/presupuestos")
  public ResponseEntity<Void> putPresupuestos(User u, @Valid @RequestBody Presupuestos p) {
    if (!p.topesValidos()) throw ApiException.badRequest("Topes inválidos.");
    save(u, "presupuestos", PRESUPUESTOS_ID, p);
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/presupuestos")
  public ResponseEntity<Void> deletePresupuestos(User u) {
    return delete(u, "presupuestos", PRESUPUESTOS_ID);
  }

  private List<JsonNode> all(User u, String coleccion) {
    return jdbc.sql("select data from user_docs where user_id = ? and coleccion = ?")
        .params(u.id(), coleccion)
        .query(String.class)
        .list()
        .stream()
        .map(json::readTree)
        .toList();
  }

  private Optional<JsonNode> find(User u, String coleccion, String id) {
    return jdbc.sql("select data from user_docs where user_id = ? and coleccion = ? and doc_id = ?")
        .params(u.id(), coleccion, id)
        .query(String.class)
        .optional()
        .map(json::readTree);
  }

  private void save(User u, String coleccion, String id, Object doc) {
    jdbc.sql(
            """
            insert into user_docs (user_id, coleccion, doc_id, data) values (?, ?, ?, cast(? as jsonb))
            on conflict (user_id, coleccion, doc_id) do update set data = excluded.data
            """)
        .params(u.id(), coleccion, id, json.writeValueAsString(doc))
        .update();
  }

  private ResponseEntity<Void> delete(User u, String coleccion, String id) {
    jdbc.sql("delete from user_docs where user_id = ? and coleccion = ? and doc_id = ?")
        .params(u.id(), coleccion, id)
        .update();
    return ResponseEntity.noContent().build();
  }

  private static void requireSameId(String pathId, String bodyId) {
    if (!pathId.equals(bodyId)) throw ApiException.badRequest("El id del documento no coincide con la ruta.");
  }

  /** Campos inmutables tras la creación (antes `request.resource.data.x == resource.data.x`). */
  private void requireUnchanged(JsonNode prev, Object next, String... fields) {
    JsonNode nextNode = json.valueToTree(next);
    for (String f : fields) {
      // Comparación textual: IntNode(5) y LongNode(5) no son equals() en Jackson.
      if (!prev.path(f).toString().equals(nextNode.path(f).toString())) {
        throw ApiException.badRequest("El campo '" + f + "' no se puede modificar.");
      }
    }
  }
}
