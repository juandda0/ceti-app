package co.ceti.shared;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ceti")
public record CetiProperties(
    String jwtSecret,
    Duration tokenTtl,
    String adminEmails,
    Google google,
    boolean devLoginEnabled,
    String corsOrigins,
    String groqApiKey) {

  public record Google(String clientIds, String clientSecret) {
    public List<String> clientIdList() {
      return csv(clientIds);
    }
  }

  public List<String> adminEmailList() {
    return csv(adminEmails).stream().map(String::toLowerCase).toList();
  }

  public List<String> corsOriginList() {
    return csv(corsOrigins);
  }

  private static List<String> csv(String value) {
    if (value == null) return List.of();
    return Arrays.stream(value.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
  }
}
