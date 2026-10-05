package co.ceti.tenancy;

import co.ceti.shared.ApiException;
import co.ceti.users.User;
import org.springframework.stereotype.Component;

/**
 * La matriz rol×acción que antes vivía en firestore.rules. Aislamiento de tenant: nadie toca un
 * colegio que no es el suyo; el admin es backend-only y solo opera cursos vía estas reglas.
 */
@Component
public class CursoAccess {

  private final TenancyRepository repo;

  public CursoAccess(TenancyRepository repo) {
    this.repo = repo;
  }

  /** Profesor listado en el curso (y del mismo colegio). */
  public boolean isProfesorDe(User u, String cid, String cursoId) {
    return u.isProfesor()
        && u.inColegio(cid)
        && repo.findCurso(cid, cursoId).map(c -> c.tieneProfesor(u.id())).orElse(false);
  }

  /** Gate Ley 1581: el estudiante solo genera/lee datos del curso cuando ya fue atestado. */
  public boolean isEstudianteActivoEn(User u, String cid, String cursoId) {
    return u.isEstudiante()
        && u.inColegio(cid)
        && cursoId.equals(u.cursoId())
        && repo.findEstudiante(cid, cursoId, u.id()).map(e -> Estudiante.ACTIVO.equals(e.estado())).orElse(false);
  }

  public void requireProfesorDe(User u, String cid, String cursoId) {
    if (!isProfesorDe(u, cid, cursoId)) throw ApiException.forbidden("No eres profesor de este curso.");
  }

  /** Lecturas del curso: su profesor o un estudiante activo de él. */
  public void requireMiembro(User u, String cid, String cursoId) {
    if (!isProfesorDe(u, cid, cursoId) && !isEstudianteActivoEn(u, cid, cursoId)) {
      throw ApiException.forbidden("Sin acceso a este curso.");
    }
  }

  /** Acciones operativas sensibles (atestar, suprimir, códigos, IA): admin o profesor del curso. */
  public void requireStaffDe(User u, String cid, String cursoId) {
    if (u.isAdmin()) return;
    if (!u.inColegio(cid)) throw ApiException.forbidden("Fuera de tu colegio.");
    if (u.isProfesor()) {
      requireProfesorDe(u, cid, cursoId);
      return;
    }
    throw ApiException.forbidden("Rol insuficiente para esta acción.");
  }
}
