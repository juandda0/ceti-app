package co.ceti.tenancy;

import co.ceti.shared.ApiException;
import co.ceti.tenancy.TenancyService.Access;
import co.ceti.tenancy.TenancyService.NuevoCurso;
import co.ceti.users.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class TenancyController {

  public record AccessRequest(@Pattern(regexp = "profesor") String requestedRole) {}

  public record JoinRequest(@NotBlank @Size(max = 20) String code) {}

  public record CursoRequest(@NotBlank @Size(max = 120) String nombre, @NotBlank String grado) {}

  public record ColegioRequest(
      @NotBlank @Size(max = 80) @Pattern(regexp = "[A-Za-z0-9_-]+") String colegioId,
      @NotBlank @Size(max = 120) String nombre,
      @Size(max = 40) String plan,
      @PositiveOrZero Integer planMaxEstudiantes) {}

  public record CodigoRequest(Boolean regenerate) {}

  public record AtestacionRequest(@NotNull Boolean atestado, @NotBlank @Size(max = 40) String politicaVersion) {}

  private final TenancyService service;
  private final TenancyRepository repo;
  private final CursoAccess access;

  public TenancyController(TenancyService service, TenancyRepository repo, CursoAccess access) {
    this.service = service;
    this.repo = repo;
    this.access = access;
  }

  @PostMapping("/me/access")
  public Access resolveMyAccess(User u, @Valid @RequestBody(required = false) AccessRequest body) {
    return service.resolveMyAccess(u, body == null ? null : body.requestedRole());
  }

  @PostMapping("/me/join")
  public TenancyRepository.CursoRef join(User u, @Valid @RequestBody JoinRequest body) {
    return service.joinByCode(u, body.code());
  }

  @PostMapping("/cursos")
  public NuevoCurso crearMiCurso(User u, @Valid @RequestBody CursoRequest body) {
    return service.crearMiCurso(u, body.nombre().trim(), body.grado().trim());
  }

  @GetMapping("/admin/colegios")
  public Map<String, List<TenancyRepository.ColegioRow>> listColegios(User u) {
    return Map.of("colegios", service.listColegios(u));
  }

  @PostMapping("/admin/colegios")
  public Map<String, String> registerColegio(User u, @Valid @RequestBody ColegioRequest body) {
    service.registerColegio(u, body.colegioId(), body.nombre().trim(), body.plan(), body.planMaxEstudiantes());
    return Map.of("colegioId", body.colegioId());
  }

  /** Identidad del colegio (nombre para cabeceras): cualquier miembro. */
  @GetMapping("/colegios/{cid}")
  public Map<String, String> colegio(User u, @PathVariable String cid) {
    if (!u.inColegio(cid)) throw ApiException.forbidden("Fuera de tu colegio.");
    String nombre = repo.colegioNombre(cid).orElseThrow(() -> ApiException.notFound("Colegio no encontrado."));
    return Map.of("id", cid, "nombre", nombre);
  }

  /** Cursos que el profesor gestiona en su colegio (nunca los de otros profesores). */
  @GetMapping("/colegios/{cid}/cursos")
  public List<Curso> misCursos(User u, @PathVariable String cid) {
    if (!u.isProfesor() || !u.inColegio(cid)) throw ApiException.forbidden("Solo el profesor del colegio.");
    return repo.cursosDeProfesor(cid, u.id());
  }

  @GetMapping("/colegios/{cid}/cursos/{cursoId}")
  public Curso curso(User u, @PathVariable String cid, @PathVariable String cursoId) {
    access.requireMiembro(u, cid, cursoId);
    return repo.findCurso(cid, cursoId).orElseThrow(() -> ApiException.notFound("Curso no encontrado."));
  }

  @PostMapping("/colegios/{cid}/cursos/{cursoId}/codigo")
  public Map<String, String> codigo(
      User u, @PathVariable String cid, @PathVariable String cursoId, @RequestBody(required = false) CodigoRequest body) {
    boolean regenerate = body != null && Boolean.TRUE.equals(body.regenerate());
    return Map.of("code", service.generateClassCode(u, cid, cursoId, regenerate));
  }

  @GetMapping("/colegios/{cid}/cursos/{cursoId}/estudiantes")
  public List<Estudiante> roster(User u, @PathVariable String cid, @PathVariable String cursoId) {
    access.requireProfesorDe(u, cid, cursoId);
    return repo.roster(cid, cursoId);
  }

  /** Su profesor, o el propio estudiante (aunque esté pendiente: así ve su estado). */
  @GetMapping("/colegios/{cid}/cursos/{cursoId}/estudiantes/{uid}")
  public Estudiante estudiante(User u, @PathVariable String cid, @PathVariable String cursoId, @PathVariable String uid) {
    boolean self = u.id().equals(uid) && u.inColegio(cid) && cursoId.equals(u.cursoId());
    if (!self) access.requireProfesorDe(u, cid, cursoId);
    return repo.findEstudiante(cid, cursoId, uid).orElseThrow(() -> ApiException.notFound("Estudiante no encontrado."));
  }

  @PostMapping("/colegios/{cid}/cursos/{cursoId}/estudiantes/{uid}/atestacion")
  public Map<String, Boolean> atestar(
      User u, @PathVariable String cid, @PathVariable String cursoId, @PathVariable String uid,
      @Valid @RequestBody AtestacionRequest body) {
    service.atestar(u, cid, cursoId, uid, body.atestado(), body.politicaVersion());
    return Map.of("atestado", body.atestado());
  }

  @PostMapping("/colegios/{cid}/cursos/{cursoId}/estudiantes/{uid}/supresion")
  public Map<String, Boolean> suprimir(User u, @PathVariable String cid, @PathVariable String cursoId, @PathVariable String uid) {
    service.suppress(u, cid, cursoId, uid);
    return Map.of("ok", true);
  }
}
