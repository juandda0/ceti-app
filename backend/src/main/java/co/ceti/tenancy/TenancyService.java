package co.ceti.tenancy;

import co.ceti.shared.ApiException;
import co.ceti.shared.CetiProperties;
import co.ceti.tenancy.TenancyRepository.CursoRef;
import co.ceti.users.User;
import co.ceti.users.UserRepository;
import java.security.SecureRandom;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TenancyService {

  public record Access(String role, String colegioId, String cursoId) {}

  public record NuevoCurso(String colegioId, String cursoId, String code) {}

  static final Set<String> GRADOS = Set.of("1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11");

  // Sin caracteres ambiguos (0/O, 1/I/L).
  private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  private static final SecureRandom RANDOM = new SecureRandom();

  private final TenancyRepository repo;
  private final UserRepository users;
  private final CursoAccess access;
  private final CetiProperties props;
  private final JdbcClient jdbc;

  public TenancyService(TenancyRepository repo, UserRepository users, CursoAccess access, CetiProperties props, JdbcClient jdbc) {
    this.repo = repo;
    this.users = users;
    this.access = access;
    this.props = props;
    this.jdbc = jdbc;
  }

  /**
   * Resuelve el acceso al iniciar sesión (D-ADMIN). Idempotente. Orden: (1) ya tiene rol → se
   * devuelve; (2) email en la allowlist → admin; (3) pide ser profesor → colegio propio aislado;
   * (4) invitado: estudiante sin clase para la experiencia pública.
   */
  @Transactional
  public Access resolveMyAccess(User u, String requestedRole) {
    if (u.role() != null) return new Access(u.role(), u.colegioId(), u.cursoId());

    String email = u.email() == null ? null : u.email().toLowerCase();
    if (email != null && props.adminEmailList().contains(email)) {
      users.setAccess(u.id(), User.ADMIN, null, null);
      return new Access(User.ADMIN, null, null);
    }
    // Un colegio nuevo por profesor auto-registrado: nunca entra al tenant de otro.
    if (User.PROFESOR.equals(requestedRole)) {
      String colegioId = UUID.randomUUID().toString();
      repo.insertColegio(colegioId, "Mi colegio", null, null, u.id());
      users.setAccess(u.id(), User.PROFESOR, colegioId, null);
      return new Access(User.PROFESOR, colegioId, null);
    }
    users.setAccess(u.id(), User.ESTUDIANTE, null, null);
    return new Access(User.ESTUDIANTE, null, null);
  }

  @Transactional
  public NuevoCurso crearMiCurso(User u, String nombre, String grado) {
    if (!u.isProfesor()) throw ApiException.forbidden("Solo un profesor crea sus clases.");
    if (u.colegioId() == null) throw ApiException.precondition("Tu cuenta no tiene un colegio asignado.");
    requireGrado(grado);
    String cursoId = UUID.randomUUID().toString();
    String code = mintUniqueCode();
    repo.insertCurso(u.colegioId(), cursoId, nombre, grado, List.of(u.id()), code, u.id());
    return new NuevoCurso(u.colegioId(), cursoId, code);
  }

  @Transactional
  public void registerColegio(User u, String colegioId, String nombre, String plan, Integer planMax) {
    if (!u.isAdmin()) throw ApiException.forbidden("Solo un admin puede registrar colegios.");
    if (repo.colegioExists(colegioId)) throw ApiException.conflict("El colegio '" + colegioId + "' ya existe.");
    repo.insertColegio(colegioId, nombre, plan, planMax, u.id());
  }

  public List<TenancyRepository.ColegioRow> listColegios(User u) {
    if (!u.isAdmin()) throw ApiException.forbidden("Solo un admin puede listar colegios.");
    return repo.listColegios();
  }

  /** (Re)genera el código de unión; regenerar invalida el anterior (vive en el mismo campo). */
  @Transactional
  public String generateClassCode(User u, String cid, String cursoId, boolean regenerate) {
    access.requireStaffDe(u, cid, cursoId);
    Curso curso = repo.findCurso(cid, cursoId).orElseThrow(() -> ApiException.notFound("Curso no encontrado."));
    if (curso.codigo() != null && !regenerate) return curso.codigo();
    String code = mintUniqueCode();
    repo.setCodigo(cid, cursoId, code);
    return code;
  }

  /**
   * Auto-unión por código (RQ-FN05): crea el slot en 'pendiente_atestacion' (gate Ley 1581) y fija
   * el tenant del estudiante. Idempotente.
   */
  @Transactional
  public CursoRef joinByCode(User u, String rawCode) {
    // Unirse reescribe el rol: sin este guard un link de invitación degradaría a un profesor.
    if (u.isProfesor() || u.isAdmin()) {
      throw ApiException.precondition("Un profesor o administrador no puede unirse a una clase como estudiante.");
    }
    String code = rawCode.trim().toUpperCase();
    CursoRef ref = repo.findCursoByCodigo(code).orElseThrow(() -> ApiException.notFound("Código de clase inválido."));
    if (ref.colegioId().equals(u.colegioId()) && ref.cursoId().equals(u.cursoId())) return ref;

    String email = u.email() == null ? "" : u.email();
    String nombre = u.displayName() != null && !u.displayName().isBlank()
        ? u.displayName()
        : email.contains("@") ? email.substring(0, email.indexOf('@')) : "Estudiante";
    repo.insertEstudianteIfAbsent(ref.colegioId(), ref.cursoId(), u.id(), email, nombre);
    users.setAccess(u.id(), User.ESTUDIANTE, ref.colegioId(), ref.cursoId());
    return ref;
  }

  /** Atestación ligera (RQ-FN10): sin PII del acudiente, solo booleano + quién/cuándo + versión. */
  @Transactional
  public void atestar(User u, String cid, String cursoId, String uid, boolean atestado, String politicaVersion) {
    access.requireStaffDe(u, cid, cursoId);
    if (repo.findEstudiante(cid, cursoId, uid).isEmpty()) {
      throw ApiException.notFound("El estudiante no existe en este curso.");
    }
    repo.setAtestacion(cid, cursoId, uid, atestado, politicaVersion, u.id());
  }

  /**
   * Derecho de supresión (Ley 1581). Irreversible: borra progreso del curso y todos los datos de la
   * cuenta (diario, presupuestos, metas, operaciones, cupos IA), marca el slot 'suprimido' y revoca
   * el acceso (efecto inmediato: el rol se lee de la BD en cada request).
   */
  @Transactional
  public void suppress(User u, String cid, String cursoId, String uid) {
    access.requireStaffDe(u, cid, cursoId);
    if (repo.findEstudiante(cid, cursoId, uid).isEmpty()) {
      throw ApiException.notFound("El estudiante no existe en este curso.");
    }
    jdbc.sql("delete from progress where colegio_id = ? and curso_id = ? and uid = ?").params(cid, cursoId, uid).update();
    jdbc.sql("delete from user_docs where user_id = ?").param(uid).update();
    jdbc.sql("delete from ia_usage where user_id = ?").param(uid).update();
    repo.marcarSuprimido(cid, cursoId, uid);
    users.setAccess(uid, null, null, null);
  }

  static void requireGrado(String grado) {
    if (!GRADOS.contains(grado)) throw ApiException.badRequest("'grado' debe ser '1'..'11'.");
  }

  private String mintUniqueCode() {
    for (int attempt = 0; attempt < 10; attempt++) {
      StringBuilder s = new StringBuilder(6);
      for (int i = 0; i < 6; i++) s.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
      if (!repo.codigoExists(s.toString())) return s.toString();
    }
    throw ApiException.internal("No se pudo generar un código único.");
  }
}
