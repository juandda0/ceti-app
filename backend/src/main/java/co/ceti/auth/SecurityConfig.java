package co.ceti.auth;

import co.ceti.shared.CetiProperties;
import co.ceti.users.UserRepository;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class SecurityConfig implements WebMvcConfigurer {

  private final UserRepository users;

  public SecurityConfig(UserRepository users) {
    this.users = users;
  }

  @Bean
  SecurityFilterChain api(HttpSecurity http, TokenService tokens, CetiProperties props) throws Exception {
    var cors = new CorsConfiguration();
    cors.setAllowedOrigins(props.corsOriginList());
    cors.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
    cors.setAllowedHeaders(List.of("Authorization", "Content-Type"));
    var corsSource = new UrlBasedCorsConfigurationSource();
    corsSource.registerCorsConfiguration("/**", cors);

    // Bearer tokens, sin cookies: no hay sesión que CSRF pueda montar.
    return http.csrf(c -> c.disable())
        .cors(c -> c.configurationSource(corsSource))
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            a ->
                a.requestMatchers(HttpMethod.POST, "/api/auth/**").permitAll()
                    .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()
                    .anyRequest().authenticated())
        .oauth2ResourceServer(o -> o.jwt(j -> j.decoder(tokens.decoder())))
        .build();
  }

  @Override
  public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
    resolvers.add(new CurrentUserResolver(users));
  }
}
