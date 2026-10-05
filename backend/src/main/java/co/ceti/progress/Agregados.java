package co.ceti.progress;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import tools.jackson.databind.JsonNode;

/**
 * Agregado por curso (RQ-FN09). Antes lo mantenía un trigger de Firestore; ahora se calcula al
 * leer desde la verdad (siempre consistente, sin documento que pueda quedar viejo).
 *
 * Invariante de privacidad (R4/R5): CERO datos nominales — ni nombres, ni emails, ni uids. Solo
 * conteos y promedios; estudiantesActivos es un CONTEO de uids distintos.
 */
public final class Agregados {

  /** 5 mundos = 5 competencias CONPES. */
  static final int WORLDS_POR_CURSO = 5;

  public record ProgressRow(String uid, String worldId, JsonNode data) {}

  public record Metricas(double masteryPromedio, int estudiantes, int completados) {}

  public record Resumen(
      String colegioId,
      String cursoId,
      Map<String, Metricas> porCompetencia,
      Map<String, Metricas> porMundo,
      int estudiantesActivos,
      double masteryPromedio,
      double porcentajeCompletado,
      long actualizadoAt) {}

  private static final class Acc {
    final List<Double> masteries = new ArrayList<>();
    final Set<String> uids = new HashSet<>();
    final Set<String> done = new HashSet<>();

    Metricas metricas() {
      return new Metricas(promedio(masteries), uids.size(), done.size());
    }
  }

  private Agregados() {}

  /** null cuando el curso no tiene progreso (el profesor no ve un agregado congelado). */
  public static Resumen resumen(String colegioId, String cursoId, List<ProgressRow> rows, long now) {
    if (rows.isEmpty()) return null;
    Map<String, Acc> porCompetencia = new LinkedHashMap<>();
    Map<String, Acc> porMundo = new LinkedHashMap<>();
    List<Double> all = new ArrayList<>();
    Set<String> activos = new HashSet<>();
    int completedSlots = 0;

    for (ProgressRow r : rows) {
      JsonNode p = r.data();
      double mastery = p.path("mastery").isNumber() ? p.get("mastery").asDouble() : 0;
      boolean completed = p.path("completed").isBoolean() && p.get("completed").asBoolean();
      String comp = p.path("competencia").isString() ? p.get("competencia").asString() : "desconocida";

      activos.add(r.uid());
      all.add(mastery);
      if (completed) completedSlots++;
      for (Acc a : List.of(
          porCompetencia.computeIfAbsent(comp, k -> new Acc()),
          porMundo.computeIfAbsent(r.worldId(), k -> new Acc()))) {
        a.masteries.add(mastery);
        a.uids.add(r.uid());
        if (completed) a.done.add(r.uid());
      }
    }

    return new Resumen(
        colegioId,
        cursoId,
        metricas(porCompetencia),
        metricas(porMundo),
        activos.size(),
        promedio(all),
        (double) completedSlots / (activos.size() * WORLDS_POR_CURSO),
        now);
  }

  private static Map<String, Metricas> metricas(Map<String, Acc> accs) {
    Map<String, Metricas> out = new LinkedHashMap<>();
    accs.forEach((k, v) -> out.put(k, v.metricas()));
    return out;
  }

  private static double promedio(List<Double> values) {
    return values.isEmpty() ? 0 : values.stream().mapToDouble(Double::doubleValue).average().orElse(0);
  }
}
