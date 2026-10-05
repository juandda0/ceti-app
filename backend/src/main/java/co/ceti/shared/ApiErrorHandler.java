package co.ceti.shared;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Every error leaves as {@code {code, message}}; unexpected ones never leak internals. */
@RestControllerAdvice
public class ApiErrorHandler {

  private static final Logger log = LoggerFactory.getLogger(ApiErrorHandler.class);

  @ExceptionHandler(ApiException.class)
  ResponseEntity<Map<String, String>> api(ApiException e) {
    return body(e.status(), e.code(), e.getMessage());
  }

  // Bodies que no cumplen el contrato (campos desconocidos, tipos, Bean Validation)
  // o que violan un CHECK de la BD: siempre culpa del cliente.
  @ExceptionHandler({
    HttpMessageNotReadableException.class,
    MethodArgumentNotValidException.class,
    HandlerMethodValidationException.class,
    DataIntegrityViolationException.class
  })
  ResponseEntity<Map<String, String>> invalid(Exception e) {
    return body(HttpStatus.BAD_REQUEST, "invalid-argument", "Datos inválidos.");
  }

  @ExceptionHandler(NoResourceFoundException.class)
  ResponseEntity<Map<String, String>> noRoute(NoResourceFoundException e) {
    return body(HttpStatus.NOT_FOUND, "not-found", "Recurso no encontrado.");
  }

  @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
  ResponseEntity<Map<String, String>> method(HttpRequestMethodNotSupportedException e) {
    return body(HttpStatus.METHOD_NOT_ALLOWED, "invalid-argument", "Método no permitido.");
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, String>> unexpected(Exception e) {
    log.error("Error inesperado", e);
    return body(HttpStatus.INTERNAL_SERVER_ERROR, "internal", "Error interno.");
  }

  private static ResponseEntity<Map<String, String>> body(
      HttpStatus status, String code, String message) {
    return ResponseEntity.status(status).body(Map.of("code", code, "message", message));
  }
}
