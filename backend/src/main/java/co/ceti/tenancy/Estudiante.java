package co.ceti.tenancy;

/** Slot del roster, keyed por el id de la cuenta (R1). Solo email + nombre (R4). */
public record Estudiante(
    String uid,
    String email,
    String nombre,
    String estado,
    boolean atestado,
    String atestadoPor,
    Long atestadoAt,
    String politicaVersion,
    Long joinedAt) {

  public static final String PENDIENTE = "pendiente_atestacion";
  public static final String ACTIVO = "activo";
  public static final String SUPRIMIDO = "suprimido";
}
