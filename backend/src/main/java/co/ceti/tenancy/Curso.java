package co.ceti.tenancy;

import java.util.List;

public record Curso(
    String id,
    String nombre,
    String grado,
    List<String> profesorUids,
    String codigo,
    Long createdAt,
    String createdByUid) {

  public boolean tieneProfesor(String uid) {
    return profesorUids.contains(uid);
  }
}
