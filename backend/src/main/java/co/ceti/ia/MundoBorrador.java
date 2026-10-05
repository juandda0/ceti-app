package co.ceti.ia;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import tools.jackson.databind.JsonNode;

/**
 * RQ-CN06 — IA de authoring docente (D-ORQ). Módulo puro: la llamada al modelo se inyecta
 * ({@link ModelCaller}) para que los tests pasen un fake. Genera un BORRADOR de mundo (teoría +
 * preguntas de los 3 tipos + elige-camino) que el endpoint DEVUELVE: nada se persiste en servidor;
 * el profesor revisa y guarda desde el cliente. El prompt recibe solo tema/nombre/grado — nunca
 * datos de estudiantes (CA2).
 */
public final class MundoBorrador {

  public static final int NOMBRE_MAX = 120;
  public static final int TEMA_MAX = 300;
  public static final int DETALLE_MAX = 300;
  /** Limita el tamaño del prompt: como mucho N líneas de previas/teoría. */
  public static final int CONTEXTO_ITEMS_MAX = 40;

  public static final List<String> ITEM_TIPOS = List.of("mc", "vf", "ordenar", "teoria");

  // Mínimos de muestreo del quiz (R9): el borrador debe superarlos para que el mundo pueda
  // activarse tras una sola pasada de IA.
  private static final int MIN_TEORIA = 1;
  private static final int MIN_MC = 4;
  private static final int MIN_VF = 3;
  private static final int MIN_ORDENAR = 3;

  public static final String SYSTEM_PROMPT_MUNDO =
      """
      Eres un diseñador de contenido de educación financiera para estudiantes colombianos de colegio. Un profesor te da el NOMBRE y el TEMA de un "mundo" (unidad de clase) y el GRADO (1 a 11). Produces exactamente un JSON con el borrador completo del mundo.

      Formato de salida (JSON estricto, sin texto adicional):
      {
        "nombre": string,                 // el nombre dado por el profesor (puedes pulirlo levemente)
        "subtitle": string,               // subtítulo corto (máx 8 palabras)
        "descripcion": string,            // 1-2 frases sobre qué aprenderá el estudiante
        "teoria": [ { "titulo": string, "cuerpo": string, "ejemplo": string } ],   // 3 a 4 tarjetas
        "mc": [ { "enunciado": string, "opciones": [string,string,string,string], "correctIndex": number, "explicacion": string } ],   // 6 preguntas
        "vf": [ { "enunciado": string, "respuesta": boolean, "explicacion": string } ],   // 5 preguntas
        "ordenar": [ { "enunciado": string, "elementosCorrectos": [string,...], "explicacion": string } ],   // 4 preguntas; 3 a 5 elementos EN SU ORDEN CORRECTO
        "eligeCamino": [ { "enunciado": string, "opcionA": {"texto": string, "consecuencia": string}, "opcionB": {"texto": string, "consecuencia": string} } ]   // 3 situaciones
      }

      Reglas obligatorias:
      1. Lenguaje NEUTRO y claro (no jerga juvenil ni regional), ejemplos cotidianos válidos en Colombia. Nunca teoría densa: tarjetas breves.
      2. La dificultad crece con el grado (1 = más simple, 11 = más avanzado); ajústala a la edad del grado.
      3. PROHIBIDO usar cifras que caducan: salario mínimo, UVT, tasas de interés vigentes, precios exactos. Usa cantidades genéricas ("una parte de tu mesada", "un porcentaje").
      4. PROHIBIDO incluir nombres de personas reales, marcas comerciales o datos personales.
      5. En "mc", el correctIndex apunta a la opción correcta (0..3) y las opciones incorrectas deben ser plausibles.
      6. En "ordenar", elementosCorrectos van EN EL ORDEN CORRECTO (el sistema los desordena después).
      7. En "eligeCamino", ninguna opción es "correcta": son decisiones con consecuencias distintas, narradas de forma neutra (sin juzgar al estudiante).
      8. Todo el contenido debe ser 100% temático del TEMA dado.""";

  public static final String SYSTEM_PROMPT_ITEM =
      """
      Eres un diseñador de contenido de educación financiera para estudiantes colombianos de colegio (13+). Un profesor edita un "mundo" (unidad de clase) y te pide UNA sola pieza de contenido del TIPO indicado. Produces exactamente un JSON: { "item": {...} } con la forma del tipo pedido.

      Formas por TIPO:
      - mc:      { "enunciado": string, "opciones": [string,string,string,string], "correctIndex": number, "explicacion": string }
      - vf:      { "enunciado": string, "respuesta": boolean, "explicacion": string }
      - ordenar: { "enunciado": string, "elementosCorrectos": [string,...], "explicacion": string }   // 3 a 5 elementos EN SU ORDEN CORRECTO
      - teoria:  { "titulo": string, "cuerpo": string, "ejemplo": string }

      Reglas obligatorias:
      1. Lenguaje NEUTRO y claro (no jerga juvenil ni regional), ejemplos cotidianos válidos en Colombia. Breve.
      2. La dificultad crece con el grado (1 = más simple, 11 = más avanzado); ajústala a la edad del grado.
      3. PROHIBIDO cifras que caducan: salario mínimo, UVT, tasas de interés vigentes, precios exactos. Usa cantidades genéricas.
      4. PROHIBIDO nombres de personas reales, marcas comerciales o datos personales.
      5. En "mc", correctIndex (0..3) apunta a la opción correcta; las incorrectas deben ser plausibles.
      6. En "ordenar", elementosCorrectos van EN EL ORDEN CORRECTO (el sistema los desordena después).
      7. La pieza debe ser 100% temática del mundo dado y NO repetir las piezas ya existentes: busca un ángulo distinto.
      8. Si es la PRIMERA pieza, hazla fácil, breve y autocontenida (calentamiento): una sola idea simple, sin asumir que el estudiante ya vio la teoría.""";

  private MundoBorrador() {}

  /** Pieza suelta generable desde el editor; los campos opcionales null se omiten del JSON. */
  public sealed interface Item permits TeoriaCard, Mc, Vf, Ordenar {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record TeoriaCard(String titulo, String cuerpo, String ejemplo) implements Item {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record Mc(String enunciado, List<String> opciones, int correctIndex, String explicacion)
      implements Item {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record Vf(String enunciado, boolean respuesta, String explicacion) implements Item {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record Ordenar(String enunciado, List<String> elementosCorrectos, String explicacion)
      implements Item {}

  public record Opcion(String texto, String consecuencia) {}

  public record EligeCamino(String enunciado, Opcion opcionA, Opcion opcionB) {}

  public record Borrador(
      String nombre,
      String subtitle,
      String descripcion,
      List<TeoriaCard> teoria,
      List<Mc> mc,
      List<Vf> vf,
      List<Ordenar> ordenar,
      List<EligeCamino> eligeCamino) {}

  /**
   * @param detalle enfoque opcional pedido desde la hoja (nullable)
   * @param teoria teoría del mundo como contexto; se ignora para tipo 'teoria' (nullable)
   * @param previas enunciados/títulos ya escritos — NO repetir (nullable)
   */
  public record GenerarItemInput(
      String tipo,
      String nombre,
      String descripcion,
      String grado,
      boolean esPrimera,
      String detalle,
      List<String> teoria,
      List<String> previas) {}

  /**
   * Valida/normaliza la salida cruda del modelo. Los ítems inválidos se DESCARTAN (el profesor revisa
   * igual); solo lanza si una sección queda bajo los mínimos de activación: un borrador que no se
   * puede activar no sirve.
   */
  public static Borrador parseBorradorMundo(JsonNode raw) {
    if (raw == null || !(raw.isObject() || raw.isArray())) {
      throw new IllegalArgumentException("Borrador inválido: no es un objeto.");
    }
    List<TeoriaCard> teoria = parseSection(raw.get("teoria"), MundoBorrador::parseTeoriaCard, 6);
    List<Mc> mc = parseSection(raw.get("mc"), MundoBorrador::parseMcItem, 10);
    List<Vf> vf = parseSection(raw.get("vf"), MundoBorrador::parseVfItem, 10);
    List<Ordenar> ordenar = parseSection(raw.get("ordenar"), MundoBorrador::parseOrdenarItem, 8);
    List<EligeCamino> eligeCamino =
        parseSection(raw.get("eligeCamino"), MundoBorrador::parseEligeCamino, 6);

    if (teoria.size() < MIN_TEORIA
        || mc.size() < MIN_MC
        || vf.size() < MIN_VF
        || ordenar.size() < MIN_ORDENAR) {
      throw new IllegalArgumentException(
          "Borrador insuficiente: teoria=%d mc=%d vf=%d ordenar=%d."
              .formatted(teoria.size(), mc.size(), vf.size(), ordenar.size()));
    }

    return new Borrador(
        Objects.requireNonNullElse(str(raw.get("nombre"), NOMBRE_MAX), ""),
        Objects.requireNonNullElse(str(raw.get("subtitle"), 80), ""),
        Objects.requireNonNullElse(str(raw.get("descripcion"), 300), ""),
        teoria,
        mc,
        vf,
        ordenar,
        eligeCamino);
  }

  /**
   * Llama al modelo y devuelve el borrador validado.
   *
   * @throws ModelApiException si el modelo falla o no devuelve JSON
   * @throws IllegalArgumentException si el borrador no alcanza los mínimos de activación
   */
  public static Borrador generarBorrador(
      String nombre, String tema, String grado, ModelCaller call) {
    String userText = "NOMBRE: " + nombre + "\nTEMA: " + tema + "\nGRADO: " + grado;
    return parseBorradorMundo(parseModelJson(call.call(SYSTEM_PROMPT_MUNDO, userText)));
  }

  // Generación de una sola pieza (RQ-CN06). Mismo camino de authoring en servidor, pero el profesor
  // pide UNA pieza de un tipo desde el editor. El prompt se fundamenta en el mundo (nombre +
  // descripción), su teoría (para preguntas), las piezas ya escritas (para no repetir) y un enfoque
  // libre opcional. La primera pieza es deliberadamente fácil/corta.

  /** Construye el turno de usuario — solo contexto del mundo/tema, nunca datos de estudiantes (CA2). */
  public static String buildItemUserText(GenerarItemInput input) {
    List<String> lines =
        new ArrayList<>(
            List.of(
                "TIPO: " + input.tipo(),
                "MUNDO: " + input.nombre(),
                "DESCRIPCIÓN DEL MUNDO: " + input.descripcion(),
                "GRADO: " + input.grado(),
                "PRIMERA PIEZA: " + (input.esPrimera() ? "sí" : "no")));
    if (input.detalle() != null && !input.detalle().isEmpty()) {
      lines.add("ENFOQUE PEDIDO: " + input.detalle());
    }
    List<String> teoria =
        input.tipo().equals("teoria") ? List.of() : firstContextItems(input.teoria());
    if (!teoria.isEmpty()) {
      lines.add("TEORÍA DEL MUNDO (para fundamentar la pregunta):");
      addNumbered(lines, teoria);
    }
    List<String> previas = firstContextItems(input.previas());
    if (!previas.isEmpty()) {
      lines.add(
          input.tipo().equals("teoria")
              ? "TÍTULOS DE TEORÍA YA EXISTENTES (no repetir):"
              : "PREGUNTAS YA EXISTENTES (no repetir):");
      addNumbered(lines, previas);
    }
    return String.join("\n", lines);
  }

  /** Extrae y valida un único ítem de {@code tipo} de la salida del modelo. */
  public static Item parseItemBorrador(String tipo, JsonNode raw) {
    if (raw == null || !(raw.isObject() || raw.isArray())) {
      throw new IllegalArgumentException("Ítem inválido: no es un objeto.");
    }
    JsonNode wrapped = raw.get("item");
    JsonNode node = wrapped != null && (wrapped.isObject() || wrapped.isArray()) ? wrapped : raw;
    Item parsed =
        switch (tipo) {
          case "mc" -> parseMcItem(node);
          case "vf" -> parseVfItem(node);
          case "ordenar" -> parseOrdenarItem(node);
          default -> parseTeoriaCard(node);
        };
    if (parsed == null) {
      throw new IllegalArgumentException("Ítem inválido para el tipo '" + tipo + "'.");
    }
    return parsed;
  }

  /**
   * Llama al modelo y devuelve un único ítem validado del tipo pedido.
   *
   * @throws ModelApiException si el modelo falla o no devuelve JSON
   * @throws IllegalArgumentException si el ítem no es válido para el tipo
   */
  public static Item generarItem(GenerarItemInput input, ModelCaller call) {
    String raw = call.call(SYSTEM_PROMPT_ITEM, buildItemUserText(input));
    return parseItemBorrador(input.tipo(), parseModelJson(raw));
  }

  private static JsonNode parseModelJson(String raw) {
    return Js.parseJson(raw)
        .orElseThrow(() -> new ModelApiException("El modelo no devolvió JSON válido."));
  }

  private static List<String> firstContextItems(List<String> items) {
    return items == null ? List.of() : items.stream().limit(CONTEXTO_ITEMS_MAX).toList();
  }

  private static void addNumbered(List<String> lines, List<String> items) {
    for (int i = 0; i < items.size(); i++) lines.add("  " + (i + 1) + ". " + items.get(i));
  }

  private static String str(JsonNode value, int max) {
    if (value == null || !value.isString()) return null;
    String trimmed = Js.trim(value.stringValue());
    return trimmed.isEmpty() ? null : Js.slice(trimmed, max);
  }

  private static <T> List<T> parseSection(
      JsonNode items, Function<JsonNode, T> parser, int max) {
    if (items == null || !items.isArray()) return List.of();
    List<T> parsed = new ArrayList<>();
    for (JsonNode item : items) {
      T value = parser.apply(item);
      if (value != null) parsed.add(value);
    }
    return parsed.stream().limit(max).toList();
  }

  private static List<String> strings(JsonNode values, int max) {
    if (values == null || !values.isArray()) return List.of();
    List<String> parsed = new ArrayList<>();
    for (JsonNode value : values) {
      String text = str(value, max);
      if (text != null) parsed.add(text);
    }
    return parsed;
  }

  // ── Parsers por ítem ──────────────────────────────────────────────────────
  // Compartidos por el parser del mundo completo y el generador de una pieza; cada uno devuelve el
  // ítem normalizado o null (inválido → el llamador lo descarta).

  private static TeoriaCard parseTeoriaCard(JsonNode card) {
    String titulo = str(card.get("titulo"), 80);
    String cuerpo = str(card.get("cuerpo"), 600);
    if (titulo == null || cuerpo == null) return null;
    return new TeoriaCard(titulo, cuerpo, str(card.get("ejemplo"), 400));
  }

  private static Mc parseMcItem(JsonNode item) {
    String enunciado = str(item.get("enunciado"), 400);
    List<String> opciones = strings(item.get("opciones"), 160);
    JsonNode index = item.get("correctIndex");
    // Más estricto que el original (que aceptaba cualquier número): un índice fraccionario no
    // apunta a ninguna opción.
    int correctIndex =
        index != null && index.isNumber() && index.doubleValue() == Math.rint(index.doubleValue())
            ? (int) index.doubleValue()
            : -1;
    if (enunciado == null
        || opciones.size() < 3
        || correctIndex < 0
        || correctIndex >= opciones.size()) {
      return null;
    }
    return new Mc(
        enunciado,
        opciones.stream().limit(5).toList(),
        correctIndex,
        str(item.get("explicacion"), 400));
  }

  private static Vf parseVfItem(JsonNode item) {
    String enunciado = str(item.get("enunciado"), 400);
    JsonNode respuesta = item.get("respuesta");
    if (enunciado == null || respuesta == null || !respuesta.isBoolean()) return null;
    return new Vf(enunciado, respuesta.booleanValue(), str(item.get("explicacion"), 400));
  }

  private static Ordenar parseOrdenarItem(JsonNode item) {
    String enunciado = str(item.get("enunciado"), 400);
    List<String> elementos = strings(item.get("elementosCorrectos"), 160);
    if (enunciado == null || elementos.size() < 3 || elementos.size() > 6) return null;
    return new Ordenar(enunciado, elementos, str(item.get("explicacion"), 400));
  }

  private static EligeCamino parseEligeCamino(JsonNode situacion) {
    String enunciado = str(situacion.get("enunciado"), 400);
    Opcion opcionA = parseOpcion(situacion.get("opcionA"));
    Opcion opcionB = parseOpcion(situacion.get("opcionB"));
    if (enunciado == null || opcionA == null || opcionB == null) return null;
    return new EligeCamino(enunciado, opcionA, opcionB);
  }

  private static Opcion parseOpcion(JsonNode opcion) {
    if (opcion == null) return null;
    String texto = str(opcion.get("texto"), 200);
    String consecuencia = str(opcion.get("consecuencia"), 400);
    return texto == null || consecuencia == null ? null : new Opcion(texto, consecuencia);
  }
}
