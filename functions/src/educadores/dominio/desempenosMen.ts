/**
 * Desempeños de la educación económica y financiera por ámbito y grupo de
 * grados (Fase 7): "Orientaciones pedagógicas para la EEF — Versión 4: 2022"
 * (MEN, Asobancaria y Fasecolda), sección 3.2, Tablas 6 a 14 (pp. 57–65). Hay
 * 101: casi siempre 3 en 1°–3° y 2 en los demás grupos.
 *
 * Cada pregunta de los bancos de Ceti lleva el `id` del desempeño que trabaja
 * (campo `desempeno`), y el panel y el informe muestran qué porcentaje de cada
 * grado lo logra. Los `id` son de Ceti (el documento no los numera): prefijo
 * del ámbito, grupo y orden en la tabla. `resumen` es una paráfrasis corta de
 * Ceti para mostrar en pantalla; el texto oficial está en la tabla y página
 * que se citan.
 *
 * El AR-1011-3 repite el AR-67-4 en el documento ("Participa en la toma de
 * decisiones colectivas…"); se conservan los dos para respetar la tabla. Puro.
 */
import type { AmbitoMen, GrupoGradoMen } from './normativa';

export interface DesempenoMen {
  id: string;
  ambito: AmbitoMen;
  grupo: GrupoGradoMen;
  resumen: string;
  /** Tabla y página de las orientaciones de 2022. */
  ref: string;
}

const PREFIJOS: Record<string, { ambito: AmbitoMen; tabla: number; pagina: number }> = {
  CE: { ambito: 'contextoEconomico', tabla: 6, pagina: 57 },
  DE: { ambito: 'desarrolloEconomico', tabla: 7, pagina: 58 },
  PE: { ambito: 'politicaEconomica', tabla: 8, pagina: 59 },
  CF: { ambito: 'contextoFinanciero', tabla: 9, pagina: 60 },
  PR: { ambito: 'presupuesto', tabla: 10, pagina: 61 },
  AI: { ambito: 'ahorroInversion', tabla: 11, pagina: 62 },
  MD: { ambito: 'manejoDeudas', tabla: 12, pagina: 63 },
  SF: { ambito: 'sistemaFinanciero', tabla: 13, pagina: 64 },
  AR: { ambito: 'analisisRiesgos', tabla: 14, pagina: 65 },
};

const GRUPOS: Record<string, GrupoGradoMen> = { '13': '1-3', '45': '4-5', '67': '6-7', '89': '8-9', '1011': '10-11' };

/** [id, paráfrasis de Ceti]. */
const FILAS: readonly (readonly [string, string])[] = [
  // Contextualización económica
  ['CE-13-1', 'Distingue recursos escasos y abundantes'],
  ['CE-13-2', 'Relaciona abundancia y escasez de los recursos'],
  ['CE-13-3', 'Cuida los recursos en casa y en el colegio'],
  ['CE-45-1', 'Identifica los recursos que importan a su familia y su comunidad'],
  ['CE-45-2', 'Prioriza con su familia y su escuela los recursos para el bienestar'],
  ['CE-67-1', 'Explica cómo los recursos ganan valor económico'],
  ['CE-67-2', 'Propone cómo proteger los recursos que valora'],
  ['CE-89-1', 'Analiza los sectores económicos y la escasez de bienes'],
  ['CE-89-2', 'Relaciona la subida de precios con su bienestar'],
  ['CE-1011-1', 'Analiza cómo usar bien los recursos de su entorno'],
  ['CE-1011-2', 'Pone en marcha estrategias para aprovechar mejor los recursos de su comunidad'],
  // Desarrollo económico
  ['DE-13-1', 'Explica las necesidades básicas y cómo se satisfacen'],
  ['DE-13-2', 'Relaciona los recursos con el bienestar de las personas'],
  ['DE-13-3', 'Entiende por qué hay personas sin acceso a lo básico'],
  ['DE-45-1', 'Explica cómo los cambios en los recursos afectan el desarrollo'],
  ['DE-45-2', 'Identifica qué pone en riesgo los recursos que se valoran'],
  ['DE-67-1', 'Indaga sobre la economía solidaria'],
  ['DE-67-2', 'Reconoce los beneficios de producir y consumir de forma solidaria'],
  ['DE-89-1', 'Analiza la economía de su entorno con indicadores'],
  ['DE-89-2', 'Propone producción y consumo responsables'],
  ['DE-1011-1', 'Comprende cómo se reparte la riqueza en su entorno'],
  ['DE-1011-2', 'Propone estrategias para el crecimiento de su región'],
  // Política económica
  ['PE-13-1', 'Cuida sus recursos porque le dan bienestar'],
  ['PE-13-2', 'Entiende para qué sirven las normas en el cuidado de los recursos'],
  ['PE-13-3', 'Explica cómo las normas ambientales conservan los recursos'],
  ['PE-45-1', 'Describe cómo funciona el Estado y quién decide la política económica'],
  ['PE-45-2', 'Entiende de dónde salen los ingresos y gastos de la nación'],
  ['PE-67-1', 'Explica cómo las decisiones del Gobierno afectan producción y consumo'],
  ['PE-67-2', 'Planea cómo enfrentar en familia el efecto de medidas del Gobierno'],
  ['PE-89-1', 'Comprende cómo los impuestos afectan el bienestar'],
  ['PE-89-2', 'Propone impuestos más eficientes y equitativos'],
  ['PE-1011-1', 'Conoce los mecanismos de participación ciudadana'],
  ['PE-1011-2', 'Propone mejoras a la política económica pensando en el bienestar'],
  // Contextualización financiera
  ['CF-13-1', 'Reconoce el dinero como recurso y medio de intercambio'],
  ['CF-13-2', 'Explica de dónde obtiene el dinero su familia'],
  ['CF-13-3', 'Reconoce las monedas y billetes de Colombia'],
  ['CF-45-1', 'Explica por qué los hábitos responsables dan bienestar'],
  ['CF-45-2', 'Entiende por qué revisar las facturas'],
  ['CF-67-1', 'Relaciona buenos hábitos financieros con el consumo'],
  ['CF-89-1', 'Identifica los hábitos financieros de su familia y planea mejorarlos'],
  ['CF-89-2', 'Reconoce el valor de los hábitos financieros responsables'],
  ['CF-1011-1', 'Explica cómo los hábitos financieros influyen en la economía'],
  ['CF-1011-2', 'Propone cómo mejorar los hábitos financieros de su comunidad'],
  // Presupuesto
  ['PR-13-1', 'Reconoce de dónde vienen y en qué se usan los recursos de la familia'],
  ['PR-13-2', 'Diferencia deseos y necesidades'],
  ['PR-13-3', 'Propone cómo repartir mejor los recursos de la familia'],
  ['PR-45-1', 'Relaciona ingresos y gastos en un presupuesto'],
  ['PR-45-2', 'Clasifica ingresos y gastos en necesidades y deseos'],
  ['PR-67-1', 'Explica cómo el presupuesto ayuda a consumir con responsabilidad'],
  ['PR-67-2', 'Arma el presupuesto de su familia con necesidades y deseos'],
  ['PR-89-1', 'Compara sus ingresos y gastos y propone mejoras'],
  ['PR-89-2', 'Compara los ingresos y gastos de su familia y propone mejoras'],
  ['PR-1011-1', 'Identifica los componentes del presupuesto departamental y nacional'],
  ['PR-1011-2', 'Propone mejoras al presupuesto nacional'],
  // Ahorro e inversión
  ['AI-13-1', 'Identifica qué recursos puede ahorrar'],
  ['AI-13-2', 'Entiende para qué le sirve ahorrar a él y a su familia'],
  ['AI-13-3', 'Se pone una meta de ahorro y la sostiene'],
  ['AI-45-1', 'Diferencia ahorrar e invertir'],
  ['AI-45-2', 'Compara el ahorro formal y el informal'],
  ['AI-67-1', 'Arma un plan de ahorro personal y lo cumple'],
  ['AI-67-2', 'Diseña estrategias de ahorro en el colegio para metas colectivas'],
  ['AI-89-1', 'Relaciona ahorro, consumo e inversión'],
  ['AI-89-2', 'Arma un plan de ahorro familiar y lo cumple'],
  ['AI-1011-1', 'Relaciona el ahorro de las familias con el desarrollo del país'],
  ['AI-1011-2', 'Propone cómo subir el ahorro del país'],
  // Manejo de deudas
  ['MD-13-1', 'Diferencia prestar, compartir y regalar'],
  ['MD-13-2', 'Identifica qué se puede prestar y qué no'],
  ['MD-13-3', 'Explica los compromisos de recibir algo prestado'],
  ['MD-45-1', 'Reconoce qué es un préstamo y qué compromete'],
  ['MD-45-2', 'Explica cuándo se justifica pedir prestado'],
  ['MD-67-1', 'Comprende beneficios e implicaciones de un préstamo'],
  ['MD-67-2', 'Compara fuentes de préstamo formales e informales'],
  ['MD-89-1', 'Relaciona ingresos y gastos con la capacidad de endeudamiento'],
  ['MD-89-2', 'Elabora un plan responsable para manejar deudas'],
  ['MD-1011-1', 'Describe los efectos del endeudamiento de las familias en el país'],
  ['MD-1011-2', 'Propone estrategias para bajar el endeudamiento de su comunidad'],
  // Sistema financiero
  ['SF-13-1', 'Reconoce el origen y la evolución del dinero'],
  ['SF-13-2', 'Nombra lugares y situaciones donde se usa el dinero'],
  ['SF-13-3', 'Entiende que manejar bien el dinero ayuda a cumplir metas'],
  ['SF-45-1', 'Compara entidades de ahorro y crédito y sus requisitos'],
  ['SF-45-2', 'Compara ventajas y desventajas de ahorrar en el sistema financiero'],
  ['SF-67-1', 'Compara productos de ahorro, inversión y crédito y elige'],
  ['SF-67-2', 'Conoce canales de atención y medios de pago'],
  ['SF-89-1', 'Comprende los seguros y los fondos de pensiones'],
  ['SF-89-2', 'Reconoce ventajas y riesgos del mercado de valores'],
  ['SF-1011-1', 'Conoce sus derechos y deberes como consumidor financiero'],
  ['SF-1011-2', 'Da a conocer en su comunidad los derechos del consumidor financiero'],
  // Análisis de riesgos (recursos de todo tipo: saber, ambiente, bienestar, dinero, relaciones)
  ['AR-13-1', 'Reconoce lo que valora en su vida diaria'],
  ['AR-13-2', 'Prioriza lo que valora'],
  ['AR-13-3', 'Reconoce que su comportamiento afecta lo que valora'],
  ['AR-45-1', 'Analiza qué en su entorno puede afectar lo que valora'],
  ['AR-45-2', 'Usa sus habilidades frente a lo que amenaza lo que valora'],
  ['AR-67-1', 'Entiende el riesgo como probabilidad e impacto'],
  ['AR-67-2', 'Evalúa sus riesgos por probabilidad e impacto'],
  ['AR-67-3', 'Reflexiona sobre lo que puede hacer ante un riesgo'],
  ['AR-67-4', 'Participa en decisiones colectivas sobre riesgos'],
  ['AR-89-1', 'Analiza su contexto antes de decidir frente a un riesgo'],
  ['AR-89-2', 'Mejora sus criterios para decidir frente a riesgos'],
  ['AR-1011-1', 'Comprende las estrategias de gestión del riesgo'],
  ['AR-1011-2', 'Analiza responsabilidades y efectos de decidir sobre riesgos'],
  ['AR-1011-3', 'Participa en decisiones colectivas sobre riesgos'],
];

function armar([id, resumen]: readonly [string, string]): DesempenoMen {
  const [pre, grupo] = id.split('-');
  const p = PREFIJOS[pre];
  return { id, ambito: p.ambito, grupo: GRUPOS[grupo], resumen, ref: `Tabla ${p.tabla}, p. ${p.pagina}` };
}

export const DESEMPENOS_MEN: readonly DesempenoMen[] = FILAS.map(armar);

const POR_ID = new Map(DESEMPENOS_MEN.map((d) => [d.id, d]));

export function desempenoMen(id: string | null | undefined): DesempenoMen | null {
  return (id && POR_ID.get(id)) || null;
}

export function desempenosDe(grupo: GrupoGradoMen, ambito?: AmbitoMen): DesempenoMen[] {
  return DESEMPENOS_MEN.filter((d) => d.grupo === grupo && (!ambito || d.ambito === ambito));
}

/**
 * Un estudiante "logra" un desempeño cuando respondió al menos
 * `MIN_RESPUESTAS_DESEMPENO` preguntas de él y acertó el `UMBRAL_LOGRO` o más.
 * Es un criterio de Ceti, un poco más exigente que el Básico de la escala por
 * defecto (que empieza en el 50 % de dominio).
 */
export const MIN_RESPUESTAS_DESEMPENO = 2;
export const UMBRAL_LOGRO = 0.6;

export function lograDesempeno(c: { respuestas: number; aciertos: number } | null | undefined): boolean | null {
  if (!c || !(c.respuestas >= MIN_RESPUESTAS_DESEMPENO)) return null;
  return c.aciertos / c.respuestas >= UMBRAL_LOGRO;
}
