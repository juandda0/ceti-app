package co.ceti.auth;

import co.ceti.shared.CetiProperties;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

/**
 * Sesión propia: un JWT HS256 que solo lleva el id del usuario. El rol NO va en el token: se lee
 * de la BD en cada request, así un cambio de rol o una supresión (Ley 1581) aplica al instante.
 */
@Service
public class TokenService {

  private static final String ISSUER = "ceti";

  private final CetiProperties props;
  private final SecretKey key;

  public TokenService(CetiProperties props) {
    this.props = props;
    byte[] secret =
        props.jwtSecret() == null ? new byte[0] : props.jwtSecret().getBytes(StandardCharsets.UTF_8);
    if (secret.length < 32) {
      throw new IllegalStateException("CETI_JWT_SECRET debe tener al menos 32 bytes.");
    }
    this.key = new SecretKeySpec(secret, "HmacSHA256");
  }

  public String issue(String userId) {
    Instant now = Instant.now();
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .issuer(ISSUER)
            .subject(userId)
            .issuedAt(now)
            .expiresAt(now.plus(props.tokenTtl()))
            .build();
    JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
    return NimbusJwtEncoder.withSecretKey(key)
        .build()
        .encode(JwtEncoderParameters.from(header, claims))
        .getTokenValue();
  }

  JwtDecoder decoder() {
    return NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
  }
}
