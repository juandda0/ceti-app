package co.ceti.progress;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import co.ceti.progress.Agregados.ProgressRow;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class AgregadosTest {

  private final JsonMapper json = JsonMapper.builder().build();

  private ProgressRow row(String uid, String world, String comp, double mastery, boolean completed) {
    return new ProgressRow(uid, world, json.createObjectNode().put("competencia", comp).put("mastery", mastery).put("completed", completed));
  }

  @Test
  void sinProgresoNoHayAgregado() {
    assertThat(Agregados.resumen("A", "c1", List.of(), 1)).isNull();
  }

  @Test
  void promediaPorCompetenciaYMundoSinDatosNominales() {
    var r = Agregados.resumen("A", "c1", List.of(
        row("s1", "world_1", "ahorro", 0.8, true),
        row("s1", "world_2", "ingreso", 0.4, false),
        row("s2", "world_1", "ahorro", 0.6, false)), 1);

    assertThat(r.estudiantesActivos()).isEqualTo(2);
    assertThat(r.masteryPromedio()).isCloseTo(0.6, within(1e-9));
    assertThat(r.porCompetencia().get("ahorro").masteryPromedio()).isCloseTo(0.7, within(1e-9));
    assertThat(r.porCompetencia().get("ahorro").estudiantes()).isEqualTo(2);
    assertThat(r.porCompetencia().get("ahorro").completados()).isEqualTo(1);
    assertThat(r.porMundo().get("world_2").estudiantes()).isEqualTo(1);
    // 1 slot completado de 2 estudiantes × 5 mundos.
    assertThat(r.porcentajeCompletado()).isCloseTo(0.1, within(1e-9));
  }
}
