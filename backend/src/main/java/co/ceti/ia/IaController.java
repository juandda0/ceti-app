package co.ceti.ia;

import co.ceti.shared.ApiException;
import co.ceti.shared.CetiProperties;
import co.ceti.tenancy.CursoAccess;
import co.ceti.users.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

/**
 * IA server-side. El asistente financiero es del estudiante; el authoring es del profesor y solo
 * DEVUELVE borradores (nunca escribe contenido) con nombre/tema/grado — jamás datos de estudiantes
 * (RQ-CN06 CA2).
 */
@RestController
@RequestMapping("/api/ia")
public class IaController {

  private static final Logger log = LoggerFactory.getLogger(IaController.class);
  private static final Set<String> GRADOS = Set.of("1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11");
  private static final int BORRADOR_CAP_DIARIO = 20;
  // Authoring granular = muchas llamadas pequeñas: cupo propio, más generoso.
  private static final int ITEM_CAP_DIARIO = 120;

  public record BorradorRequest(
      @NotBlank String colegioId, @NotBlank String cursoId, @NotBlank String nombre,
      @NotBlank String tema, @NotBlank String grado) {}

  public record ItemRequest(
      @NotBlank String colegioId, @NotBlank String cursoId, @NotBlank String tipo,
      @NotBlank String nombre, @NotBlank String descripcion, @NotBlank String grado,
      Boolean esPrimera, String detalle, List<String> teoria, List<String> previas) {}

  private final JdbcClient jdbc;
  private final CursoAccess access;
  private final CetiProperties props;

  public IaController(JdbcClient jdbc, CursoAccess access, CetiProperties props) {
    this.jdbc = jdbc;
    this.access = access;
    this.props = props;
  }

  @PostMapping("/plan-financiero")
  public FinancialPlan planFinanciero(User u, @RequestBody JsonNode body) {
    if (!u.isEstudiante()) throw ApiException.forbidden("Solo estudiantes usan el asistente financiero.");
    try {
      return FinancialAssistant.planFinancialActionsWithQuota(
          body, groq(1200, Duration.ofSeconds(20)), () -> consumeQuota(u.id()));
    } catch (RuntimeException e) {
      var mapped = FinancialAssistant.classifyFinancialAssistantError(e);
      if (mapped.logCode() != null) log.error("planificarAccionesFinancieras: fallo {}", mapped.logCode());
      throw mapped.error();
    }
  }

  @PostMapping("/borrador-mundo")
  public MundoBorrador.Borrador borradorMundo(User u, @Valid @RequestBody BorradorRequest r) {
    if (!u.isProfesor()) throw ApiException.forbidden("Solo profesores generan borradores.");
    String nombre = r.nombre().trim(), tema = r.tema().trim(), grado = r.grado().trim();
    if (nombre.length() > MundoBorrador.NOMBRE_MAX || tema.length() > MundoBorrador.TEMA_MAX || !GRADOS.contains(grado)) {
      throw ApiException.badRequest("Parámetros fuera de rango.");
    }
    access.requireStaffDe(u, r.colegioId(), r.cursoId());
    requireUnderCap(u.id(), "borrador", BORRADOR_CAP_DIARIO, "Límite diario de generación con IA alcanzado.");
    MundoBorrador.Borrador borrador =
        generate(() -> MundoBorrador.generarBorrador(nombre, tema, grado, groq(4000, Duration.ofSeconds(45))), "el borrador");
    // Solo el éxito consume cupo (mismo criterio que antes).
    increment(u.id(), "borrador");
    return borrador;
  }

  @PostMapping("/item-contenido")
  public MundoBorrador.Item itemContenido(User u, @Valid @RequestBody ItemRequest r) {
    if (!u.isProfesor()) throw ApiException.forbidden("Solo profesores generan contenido.");
    String nombre = r.nombre().trim(), descripcion = r.descripcion().trim(), grado = r.grado().trim();
    if (!MundoBorrador.ITEM_TIPOS.contains(r.tipo())
        || nombre.length() > MundoBorrador.NOMBRE_MAX
        || descripcion.length() > MundoBorrador.TEMA_MAX
        || !GRADOS.contains(grado)) {
      throw ApiException.badRequest("Parámetros fuera de rango.");
    }
    String detalle = r.detalle() == null || r.detalle().isBlank()
        ? null
        : truncate(r.detalle().trim(), MundoBorrador.DETALLE_MAX);
    access.requireStaffDe(u, r.colegioId(), r.cursoId());
    requireUnderCap(u.id(), "item", ITEM_CAP_DIARIO, "Límite diario de generación alcanzado.");
    var input = new MundoBorrador.GenerarItemInput(
        r.tipo(), nombre, descripcion, grado, Boolean.TRUE.equals(r.esPrimera()), detalle,
        contexto(r.teoria(), 800), contexto(r.previas(), 400));
    MundoBorrador.Item item =
        generate(() -> MundoBorrador.generarItem(input, groq(900, Duration.ofSeconds(30))), "el contenido");
    increment(u.id(), "item");
    return item;
  }

  private ModelCaller groq(int maxTokens, Duration timeout) {
    if (props.groqApiKey() == null || props.groqApiKey().isBlank()) {
      throw ApiException.unavailable("El generador no está disponible, intenta de nuevo.");
    }
    return GroqClient.caller(props.groqApiKey(), maxTokens, timeout);
  }

  private static <T> T generate(java.util.function.Supplier<T> call, String what) {
    try {
      return call.get();
    } catch (ApiException e) {
      throw e;
    } catch (ModelApiException e) {
      log.error("IA authoring: modelo no disponible", e);
      throw ApiException.unavailable("El generador no está disponible, intenta de nuevo.");
    } catch (RuntimeException e) {
      log.error("IA authoring: salida inválida", e);
      throw ApiException.internal("No se pudo generar " + what + ".");
    }
  }

  /** Atómico: el intento consume cupo aunque Groq falle (limita coste y abuso concurrente). */
  private void consumeQuota(String uid) {
    boolean ok = jdbc.sql(
            """
            insert into ia_usage (user_id, kind, day, count) values (?, 'asistente', ?, 1)
            on conflict (user_id, kind, day) do update set count = ia_usage.count + 1
              where ia_usage.count < ?
            returning count
            """)
        .params(uid, today(), FinancialAssistant.DAILY_QUOTA_LIMIT)
        .query(Integer.class)
        .optional()
        .isPresent();
    if (!ok) throw new FinancialAssistant.QuotaExceededException();
  }

  private void requireUnderCap(String uid, String kind, int cap, String message) {
    int count = jdbc.sql("select count from ia_usage where user_id = ? and kind = ? and day = ?")
        .params(uid, kind, today())
        .query(Integer.class)
        .optional()
        .orElse(0);
    if (count >= cap) throw ApiException.quota(message);
  }

  private void increment(String uid, String kind) {
    jdbc.sql(
            """
            insert into ia_usage (user_id, kind, day, count) values (?, ?, ?, 1)
            on conflict (user_id, kind, day) do update set count = ia_usage.count + 1
            """)
        .params(uid, kind, today())
        .update();
  }

  /** Líneas de contexto saneadas (sin PII — CA2), con tope de tamaño del prompt. */
  private static List<String> contexto(List<String> lines, int maxLen) {
    if (lines == null) return List.of();
    return lines.stream()
        .map(l -> l == null ? "" : truncate(l.trim(), maxLen))
        .filter(l -> !l.isEmpty())
        .limit(MundoBorrador.CONTEXTO_ITEMS_MAX)
        .toList();
  }

  private static String truncate(String s, int max) {
    return s.length() <= max ? s : s.substring(0, max);
  }

  private static LocalDate today() {
    return LocalDate.now(ZoneOffset.UTC);
  }
}
