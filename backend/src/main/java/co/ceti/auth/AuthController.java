package co.ceti.auth;

import co.ceti.auth.GoogleIdentityVerifier.GoogleIdentity;
import co.ceti.shared.ApiException;
import co.ceti.shared.CetiProperties;
import co.ceti.users.User;
import co.ceti.users.UserRepository;
import co.ceti.users.UserView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  public record GoogleLogin(@Size(max = 4096) String idToken, @Size(max = 1024) String code) {}

  public record DevLogin(@NotBlank @Email @Size(max = 200) String email, @Size(max = 80) String name) {}

  public record Session(String token, UserView user) {}

  private final GoogleIdentityVerifier google;
  private final UserRepository users;
  private final TokenService tokens;
  private final CetiProperties props;

  public AuthController(
      GoogleIdentityVerifier google, UserRepository users, TokenService tokens, CetiProperties props) {
    this.google = google;
    this.users = users;
    this.tokens = tokens;
    this.props = props;
  }

  @PostMapping("/google")
  public Session google(@Valid @RequestBody GoogleLogin body) {
    GoogleIdentity id;
    if (body.idToken() != null && !body.idToken().isBlank()) {
      id = google.fromIdToken(body.idToken());
    } else if (body.code() != null && !body.code().isBlank()) {
      id = google.fromAuthCode(body.code());
    } else {
      throw ApiException.badRequest("Falta idToken o code.");
    }
    return session(users.upsertIdentity("google", id.sub(), id.email(), displayName(id.name(), id.email()), id.picture()));
  }

  /** Solo desarrollo/E2E (CETI_DEV_LOGIN=true): identidad sin verificar. */
  @PostMapping("/dev")
  public Session dev(@Valid @RequestBody DevLogin body) {
    if (!props.devLoginEnabled()) throw ApiException.notFound("Recurso no encontrado.");
    String email = body.email().trim().toLowerCase();
    return session(users.upsertIdentity("dev", email, email, displayName(body.name(), email), null));
  }

  private Session session(User user) {
    return new Session(tokens.issue(user.id()), UserView.of(user));
  }

  private static String displayName(String name, String email) {
    if (name != null && !name.isBlank()) return name.trim();
    if (email != null && email.contains("@")) return email.substring(0, email.indexOf('@'));
    return "Usuario";
  }
}
