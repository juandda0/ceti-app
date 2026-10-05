package co.ceti.ia;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import co.ceti.ia.MundoBorrador.Borrador;
import co.ceti.ia.MundoBorrador.GenerarItemInput;
import co.ceti.ia.MundoBorrador.Item;
import co.ceti.ia.MundoBorrador.Mc;
import co.ceti.ia.MundoBorrador.Vf;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.node.StringNode;

class MundoBorradorTest {

  private static ObjectNode tree(Object value) {
    return Js.MAPPER.valueToTree(value);
  }

  private static ObjectNode validRaw() {
    return tree(
        Map.of(
            "nombre", "La Feria del Trueque",
            "subtitle", "Negociar con cabeza",
            "descripcion", "Aprende a comparar precios y negociar.",
            "teoria",
                List.of(
                    Map.of(
                        "titulo", "Comparar",
                        "cuerpo", "Antes de comprar, compara al menos dos opciones."),
                    Map.of(
                        "titulo", "Negociar",
                        "cuerpo", "Negociar es buscar un acuerdo justo.",
                        "ejemplo", "En la plaza.")),
            "mc",
                IntStream.range(0, 6)
                    .mapToObj(
                        i ->
                            Map.of(
                                "enunciado", "Pregunta de opción múltiple número " + (i + 1),
                                "opciones", List.of("a", "b", "c", "d"),
                                "correctIndex", i % 4,
                                "explicacion", "Porque sí."))
                    .toList(),
            "vf",
                IntStream.range(0, 5)
                    .mapToObj(
                        i ->
                            Map.of(
                                "enunciado", "Afirmación número " + (i + 1) + " sobre el tema",
                                "respuesta", i % 2 == 0))
                    .toList(),
            "ordenar",
                IntStream.range(0, 4)
                    .mapToObj(
                        i ->
                            Map.of(
                                "enunciado", "Ordena los pasos del caso " + (i + 1),
                                "elementosCorrectos", List.of("paso uno", "paso dos", "paso tres")))
                    .toList(),
            "eligeCamino",
                List.of(
                    Map.of(
                        "enunciado", "Te ofrecen dos formas de pago",
                        "opcionA",
                            Map.of("texto", "De contado", "consecuencia", "Pagas menos en total."),
                        "opcionB",
                            Map.of(
                                "texto", "A cuotas",
                                "consecuencia", "Pagas más pero por partes.")))));
  }

  private static ModelCaller replying(String response, List<String> userTexts) {
    return (systemPrompt, userText) -> {
      userTexts.add(userText);
      return response;
    };
  }

  @Nested
  class ParseBorradorMundo {

    @Test
    void aceptaUnBorradorValidoCompleto() {
      Borrador b = MundoBorrador.parseBorradorMundo(validRaw());
      assertThat(b.mc()).hasSize(6);
      assertThat(b.vf()).hasSize(5);
      assertThat(b.ordenar()).hasSize(4);
      assertThat(b.teoria()).hasSize(2);
      assertThat(b.eligeCamino()).hasSize(1);
    }

    @Test
    void descartaItemsInvalidosMcConCorrectIndexFueraDeRango() {
      ObjectNode raw = validRaw();
      ((ArrayNode) raw.get("mc"))
          .add(
              tree(
                  Map.of(
                      "enunciado", "Pregunta rota con índice malo",
                      "opciones", List.of("a", "b", "c"),
                      "correctIndex", 7)));
      assertThat(MundoBorrador.parseBorradorMundo(raw).mc()).hasSize(6);
    }

    @Test
    void lanzaSiUnaSeccionQuedaPorDebajoDelMinimoDeActivacion() {
      ObjectNode raw = validRaw();
      ArrayNode mc = (ArrayNode) raw.get("mc");
      while (mc.size() > 2) mc.remove(mc.size() - 1);
      assertThatThrownBy(() -> MundoBorrador.parseBorradorMundo(raw))
          .hasMessageContaining("insuficiente");
    }

    @Test
    void lanzaSiLaRaizNoEsUnObjeto() {
      assertThatThrownBy(() -> MundoBorrador.parseBorradorMundo(StringNode.valueOf("hola")))
          .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void truncaStringsLargosYOmiteExplicacionesVacias() {
      ObjectNode raw = validRaw();
      raw.get("vf")
          .forEach(
              q -> ((ObjectNode) q).put("enunciado", "x".repeat(1000)).put("explicacion", "   "));
      Borrador b = MundoBorrador.parseBorradorMundo(raw);
      assertThat(b.vf().get(0).enunciado()).hasSize(400);
      assertThat(b.vf().get(0).explicacion()).isNull();
      assertThat(Js.MAPPER.valueToTree(b.vf().get(0)).has("explicacion")).isFalse();
    }
  }

  @Nested
  class GenerarBorrador {

    @Test
    void propagaModelApiExceptionCuandoElModeloNoDevuelveJson() {
      assertThatThrownBy(
              () ->
                  MundoBorrador.generarBorrador(
                      "x", "y", "9", replying("esto no es json", new ArrayList<>())))
          .isInstanceOf(ModelApiException.class);
    }

    @Test
    void pasaSoloNombreTemaGradoAlModelo() {
      List<String> calls = new ArrayList<>();
      MundoBorrador.generarBorrador(
          "Feria", "trueque", "10", replying(Js.MAPPER.writeValueAsString(validRaw()), calls));
      assertThat(calls.get(0)).isEqualTo("NOMBRE: Feria\nTEMA: trueque\nGRADO: 10");
    }
  }

  @Nested
  class ParseItemBorrador {

    private final Map<String, Object> mcRaw =
        Map.of(
            "enunciado", "Una pregunta válida de prueba",
            "opciones", List.of("a", "b", "c"),
            "correctIndex", 1);

    @Test
    void aceptaUnItemEnvueltoEnItem() {
      Mc item = (Mc) MundoBorrador.parseItemBorrador("mc", tree(Map.of("item", mcRaw)));
      assertThat(item.correctIndex()).isEqualTo(1);
      assertThat(item.opciones()).hasSize(3);
    }

    @Test
    void aceptaElItemSinEnvolver() {
      Mc item = (Mc) MundoBorrador.parseItemBorrador("mc", tree(mcRaw));
      assertThat(item.enunciado()).contains("pregunta");
    }

    @Test
    void lanzaSiElItemEsInvalidoParaElTipo() {
      ObjectNode raw = tree(mcRaw).put("correctIndex", 9);
      assertThatThrownBy(() -> MundoBorrador.parseItemBorrador("mc", raw))
          .hasMessageContaining("Ítem inválido");
    }

    @Test
    void lanzaSiLaRaizNoEsUnObjeto() {
      assertThatThrownBy(() -> MundoBorrador.parseItemBorrador("vf", StringNode.valueOf("nope")))
          .isInstanceOf(IllegalArgumentException.class);
    }
  }

  @Nested
  class BuildItemUserText {

    @Test
    void incluyeTeoriaYPreviasComoContextoParaPreguntas() {
      String text =
          MundoBorrador.buildItemUserText(
              new GenerarItemInput(
                  "mc",
                  "Feria",
                  "sobre trueque",
                  "9",
                  false,
                  "enfoque en descuentos",
                  List.of("Comparar: mira dos opciones"),
                  List.of("¿Qué es comparar precios?")));
      assertThat(text)
          .contains(
              "PRIMERA PIEZA: no",
              "ENFOQUE PEDIDO: enfoque en descuentos",
              "TEORÍA DEL MUNDO",
              "PREGUNTAS YA EXISTENTES");
    }

    @Test
    void ignoraLaTeoriaAlGenerarTeoriaYMarcaLaPrimera() {
      String text =
          MundoBorrador.buildItemUserText(
              new GenerarItemInput(
                  "teoria",
                  "Feria",
                  "sobre trueque",
                  "9",
                  true,
                  null,
                  List.of("no debería aparecer"),
                  List.of("Comparar")));
      assertThat(text).contains("PRIMERA PIEZA: sí", "TÍTULOS DE TEORÍA YA EXISTENTES");
      assertThat(text).doesNotContain("TEORÍA DEL MUNDO");
    }
  }

  @Nested
  class GenerarItem {

    @Test
    void propagaModelApiExceptionCuandoElModeloNoDevuelveJson() {
      GenerarItemInput input = new GenerarItemInput("vf", "x", "y", "9", true, null, null, null);
      assertThatThrownBy(
              () -> MundoBorrador.generarItem(input, replying("no json", new ArrayList<>())))
          .isInstanceOf(ModelApiException.class);
    }

    @Test
    void devuelveElItemValidadoDelTipoPedido() {
      GenerarItemInput input =
          new GenerarItemInput("vf", "Feria", "trueque", "10", false, null, null, null);
      Item item =
          MundoBorrador.generarItem(
              input,
              replying(
                  "{\"item\":{\"enunciado\":\"Ahorrar siempre conviene\",\"respuesta\":true}}",
                  new ArrayList<>()));

      assertThat(item).isEqualTo(new Vf("Ahorrar siempre conviene", true, null));
      JsonNode serialized = Js.MAPPER.valueToTree(item);
      assertThat(serialized)
          .isEqualTo(tree(Map.of("enunciado", "Ahorrar siempre conviene", "respuesta", true)));
    }
  }
}
