package co.ceti.users;

import tools.jackson.databind.JsonNode;

/** Cuenta autenticada. role/colegioId/cursoId son el antiguo set de custom claims. */
public record User(
    String id,
    String provider,
    String email,
    String displayName,
    String photoUrl,
    JsonNode profile,
    String role,
    String colegioId,
    String cursoId) {

  public static final String ADMIN = "admin";
  public static final String PROFESOR = "profesor";
  public static final String ESTUDIANTE = "estudiante";

  public boolean isAdmin() {
    return ADMIN.equals(role);
  }

  public boolean isProfesor() {
    return PROFESOR.equals(role);
  }

  public boolean isEstudiante() {
    return ESTUDIANTE.equals(role);
  }

  public boolean inColegio(String cid) {
    return cid != null && cid.equals(colegioId);
  }
}
