package co.ceti.ia;

/** Error de red, HTTP o respuesta vacía del proveedor de IA. */
public class ModelApiException extends RuntimeException {

  public ModelApiException(String message) {
    super(message);
  }
}
