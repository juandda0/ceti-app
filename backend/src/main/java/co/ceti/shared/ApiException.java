package co.ceti.shared;

import org.springframework.http.HttpStatus;

/**
 * Expected, client-facing failure (validation, authz, quota...). The handler turns it into
 * {@code {code, message}} with the given status; anything else is an unexpected 500.
 */
public class ApiException extends RuntimeException {

  private final HttpStatus status;
  private final String code;

  public ApiException(HttpStatus status, String code, String message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  public HttpStatus status() {
    return status;
  }

  public String code() {
    return code;
  }

  public static ApiException badRequest(String message) {
    return new ApiException(HttpStatus.BAD_REQUEST, "invalid-argument", message);
  }

  public static ApiException forbidden(String message) {
    return new ApiException(HttpStatus.FORBIDDEN, "permission-denied", message);
  }

  public static ApiException notFound(String message) {
    return new ApiException(HttpStatus.NOT_FOUND, "not-found", message);
  }

  public static ApiException conflict(String message) {
    return new ApiException(HttpStatus.CONFLICT, "already-exists", message);
  }

  public static ApiException precondition(String message) {
    return new ApiException(HttpStatus.PRECONDITION_FAILED, "failed-precondition", message);
  }

  public static ApiException quota(String message) {
    return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "resource-exhausted", message);
  }

  public static ApiException unavailable(String message) {
    return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "unavailable", message);
  }

  public static ApiException internal(String message) {
    return new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "internal", message);
  }
}
