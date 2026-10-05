package co.ceti.ia;

/** Llamada al modelo inyectada: los tests la reemplazan por un fake sin red. */
@FunctionalInterface
public interface ModelCaller {

  /**
   * @return el texto devuelto por el modelo
   * @throws ModelApiException si falla la red, el HTTP o la respuesta viene vacía
   */
  String call(String systemPrompt, String userText);
}
