package co.ceti.auth;

import co.ceti.shared.ApiException;
import co.ceti.shared.CetiProperties;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;

/** Valida identidades de Google: ID token (nativo) o authorization code del popup web. */
@Component
public class GoogleIdentityVerifier {

  private static final String JWKS = "https://www.googleapis.com/oauth2/v3/certs";
  private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
  private static final Set<String> ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");

  public record GoogleIdentity(String sub, String email, String name, String picture) {}

  private final CetiProperties props;
  private final RestClient http = RestClient.create();
  private final JwtDecoder decoder;

  public GoogleIdentityVerifier(CetiProperties props) {
    this.props = props;
    NimbusJwtDecoder nimbus = NimbusJwtDecoder.withJwkSetUri(JWKS).build();
    nimbus.setJwtValidator(
        new DelegatingOAuth2TokenValidator<>(
            new JwtTimestampValidator(),
            jwt -> check(ISSUERS.contains(String.valueOf(jwt.getClaimAsString("iss"))), "iss"),
            jwt -> check(audienceAllowed(jwt.getAudience()), "aud")));
    this.decoder = nimbus;
  }

  public GoogleIdentity fromIdToken(String idToken) {
    Jwt jwt;
    try {
      jwt = decoder.decode(idToken);
    } catch (JwtException e) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthenticated", "Credencial de Google inválida.");
    }
    if (!Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"))) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthenticated", "El correo de Google no está verificado.");
    }
    return new GoogleIdentity(
        jwt.getSubject(),
        jwt.getClaimAsString("email"),
        jwt.getClaimAsString("name"),
        jwt.getClaimAsString("picture"));
  }

  /** Popup web (GIS code client): el redirect_uri "postmessage" es el que fija Google. */
  public GoogleIdentity fromAuthCode(String code) {
    List<String> clientIds = props.google().clientIdList();
    String secret = props.google().clientSecret();
    if (clientIds.isEmpty() || secret == null || secret.isBlank()) {
      throw ApiException.precondition("Login web con Google no configurado.");
    }
    var form = new LinkedMultiValueMap<String, String>();
    form.add("code", code);
    form.add("client_id", clientIds.getFirst());
    form.add("client_secret", secret);
    form.add("redirect_uri", "postmessage");
    form.add("grant_type", "authorization_code");
    JsonNode res;
    try {
      res = http.post().uri(TOKEN_URL).contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().body(JsonNode.class);
    } catch (RestClientException e) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthenticated", "Google rechazó el inicio de sesión.");
    }
    JsonNode idToken = res == null ? null : res.get("id_token");
    if (idToken == null || !idToken.isString()) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthenticated", "Google no devolvió un ID token.");
    }
    return fromIdToken(idToken.asString());
  }

  private boolean audienceAllowed(List<String> aud) {
    List<String> allowed = props.google().clientIdList();
    return aud != null && aud.stream().anyMatch(allowed::contains);
  }

  private static OAuth2TokenValidatorResult check(boolean ok, String claim) {
    return ok
        ? OAuth2TokenValidatorResult.success()
        : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Claim inválido: " + claim, null));
  }
}
