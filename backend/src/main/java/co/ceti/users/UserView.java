package co.ceti.users;

import com.fasterxml.jackson.annotation.JsonInclude;
import tools.jackson.databind.JsonNode;

/** Lo que el cliente ve de su cuenta (perfil + rol/tenant para enrutar la UI). */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record UserView(
    String id,
    String email,
    String displayName,
    String photoURL,
    String provider,
    JsonNode profile,
    String role,
    String colegioId,
    String cursoId) {

  public static UserView of(User u) {
    return new UserView(
        u.id(), u.email(), u.displayName(), u.photoUrl(), u.provider(), u.profile(), u.role(), u.colegioId(), u.cursoId());
  }
}
