package co.ceti.auth;

import co.ceti.shared.ApiException;
import co.ceti.users.User;
import co.ceti.users.UserRepository;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/** Inyecta el {@link User} del token, recargado de la BD (rol/tenant siempre frescos). */
class CurrentUserResolver implements HandlerMethodArgumentResolver {

  private final UserRepository users;

  CurrentUserResolver(UserRepository users) {
    this.users = users;
  }

  @Override
  public boolean supportsParameter(MethodParameter parameter) {
    return parameter.getParameterType().equals(User.class);
  }

  @Override
  public User resolveArgument(
      MethodParameter parameter,
      ModelAndViewContainer mav,
      NativeWebRequest request,
      WebDataBinderFactory binder) {
    if (!(SecurityContextHolder.getContext().getAuthentication().getPrincipal() instanceof Jwt jwt)) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthenticated", "Inicia sesión.");
    }
    return users
        .findById(jwt.getSubject())
        .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "unauthenticated", "Inicia sesión."));
  }
}
