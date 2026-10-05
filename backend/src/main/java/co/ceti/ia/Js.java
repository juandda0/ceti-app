package co.ceti.ia;

import java.util.Optional;
import java.util.regex.Pattern;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Semántica JS de la que dependen los parsers portados desde functions/: las validaciones (longitudes,
 * trim, regex) deben comportarse igual que en el backend TypeScript para no abrir ni cerrar casos.
 */
final class Js {

  // Como JSON.parse: basura tras el valor raíz invalida el documento.
  static final JsonMapper MAPPER =
      JsonMapper.builder().enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).build();

  // \s de JS es Unicode; el de Java solo ASCII. Se usa como cuerpo de clase de caracteres.
  private static final String WHITESPACE =
      "\\t\\n\\x0B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF";

  private Js() {}

  /** JSON.parse: vacío o inválido → empty. */
  static Optional<JsonNode> parseJson(String raw) {
    try {
      JsonNode node = MAPPER.readTree(raw);
      return node == null || node.isMissingNode() ? Optional.empty() : Optional.of(node);
    } catch (JacksonException e) {
      return Optional.empty();
    }
  }

  /** String.prototype.trim: el trim() de Java recorta controles y no reconoce espacios Unicode. */
  static String trim(String value) {
    int start = 0;
    int end = value.length();
    while (start < end && isWhitespace(value.charAt(start))) start++;
    while (end > start && isWhitespace(value.charAt(end - 1))) end--;
    return value.substring(start, end);
  }

  /** String.prototype.slice(0, max) sobre unidades UTF-16, igual que String.length en Java. */
  static String slice(String value, int max) {
    return value.length() <= max ? value : value.substring(0, max);
  }

  /**
   * Compila una regex escrita con la sintaxis JS: traduce {@code \s} a espacios Unicode. {@code \d} y
   * {@code \b} ya son ASCII en Java 21, como en JS.
   */
  static Pattern regex(String jsSource, int flags) {
    String source = jsSource.replace("[\\s", "[" + WHITESPACE).replace("\\s", "[" + WHITESPACE + "]");
    return Pattern.compile(source, flags);
  }

  private static boolean isWhitespace(char c) {
    return c == '\t'
        || c == '\n'
        || c == 0x0B
        || c == '\f'
        || c == '\r'
        || c == 0xFEFF
        || c == 0x2028
        || c == 0x2029
        || Character.getType(c) == Character.SPACE_SEPARATOR;
  }
}
