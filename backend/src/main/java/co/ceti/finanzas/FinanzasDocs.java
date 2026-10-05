package co.ceti.finanzas;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.Map;

/**
 * Forma exacta de los documentos personales (antes validGoal/validSavingsOperation/movimientos en
 * firestore.rules). Campos desconocidos → 400 (fail-on-unknown-properties). Dinero simulado o
 * auto-declarado: entero 1..100.000.000.
 */
final class FinanzasDocs {

  static final long MONEY_MAX = 100_000_000L;
  static final String CATEGORIAS = "comida|transporte|entretenimiento|ropa|educacion|tecnologia|regalos|otros";

  private FinanzasDocs() {}

  record Goal(
      @NotBlank @Size(max = 100) String id,
      @NotBlank @Size(max = 80) String title,
      @NotNull @Pattern(regexp = "bike|book|laptop|plane|shield|target") String iconId,
      @NotNull @Pattern(regexp = "electronics|toy|trip|education|emergency|custom") String category,
      @NotNull @Min(1) @Max(MONEY_MAX) Long targetAmount,
      @PositiveOrZero Long deadline,
      @NotNull @PositiveOrZero Long createdAt,
      @NotNull @PositiveOrZero Long updatedAt,
      @PositiveOrZero Long deletedAt) {}

  record Operation(
      @NotBlank @Size(max = 100) String id,
      @NotNull @Pattern(regexp = "aporte|retiro") String type,
      @NotNull @Min(1) @Max(MONEY_MAX) Long amount,
      @NotNull @Size(max = 140) String description,
      @Size(min = 1, max = 100) String goalId,
      @NotNull @PositiveOrZero Long fecha,
      @NotNull @PositiveOrZero Long createdAt,
      @NotNull @PositiveOrZero Long updatedAt) {}

  record Movimiento(
      @NotBlank @Size(max = 100) String id,
      @NotNull @Pattern(regexp = "gasto") String tipo,
      @NotNull @Min(1) @Max(MONEY_MAX) Long monto,
      @NotNull @Size(max = 140) String descripcion,
      @NotNull @Pattern(regexp = CATEGORIAS) String categoria,
      @NotNull @Pattern(regexp = "voz|manual") String origen,
      @NotNull @PositiveOrZero Long fecha,
      @NotNull @PositiveOrZero Long createdAt,
      @NotNull @PositiveOrZero Long updatedAt) {}

  /** Se escribe entero: quitar un tope lo elimina del mapa. */
  record Presupuestos(@NotNull Map<String, Long> topes, @NotNull @PositiveOrZero Long updatedAt) {
    boolean topesValidos() {
      return topes.entrySet().stream()
          .allMatch(e -> e.getKey().matches(CATEGORIAS) && e.getValue() != null && e.getValue() >= 1 && e.getValue() <= MONEY_MAX);
    }
  }
}
