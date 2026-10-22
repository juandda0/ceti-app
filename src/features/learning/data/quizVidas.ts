/**
 * Intento de una lección o del jefe de un planeta. Hay que contestar bien todas las
 * preguntas: una respuesta incorrecta vuelve al final de la cola (después de explicarla).
 * Las lecciones no tienen vidas (SIN_LIMITE); el jefe empieza con VIDAS_POR_MUNDO y sin
 * vidas el intento se pierde. Puro: la pantalla solo guarda el intento en su estado.
 */

export const VIDAS_POR_MUNDO = 3;
/** Vidas de una lección normal: equivocarse nunca la termina. */
export const SIN_LIMITE = Number.POSITIVE_INFINITY;

export type EstadoIntento = 'jugando' | 'completado' | 'perdido';

export interface IntentoQuiz {
  /** Índices de las preguntas del mundo en el orden en que se presentan (con repeticiones al final). */
  readonly cola: readonly number[];
  /** Posición en `cola` de la pregunta actual. */
  readonly pos: number;
  readonly vidas: number;
  /** Preguntas distintas contestadas bien. */
  readonly aciertos: number;
  readonly errores: number;
  /** Número de preguntas del mundo. */
  readonly total: number;
  /** Preguntas (índices) falladas al menos una vez: la maestría cuenta solo las acertadas a la primera. */
  readonly falladas: readonly number[];
}

export function nuevoIntento(total: number, vidas: number = VIDAS_POR_MUNDO): IntentoQuiz {
  return {
    cola: Array.from({ length: total }, (_, i) => i),
    pos: 0,
    vidas,
    aciertos: 0,
    errores: 0,
    total,
    falladas: [],
  };
}

/** Preguntas contestadas bien en el primer intento. */
export function acertadasALaPrimera(intento: IntentoQuiz): number {
  return intento.total - intento.falladas.length;
}

/** Índice (en las preguntas del mundo) de la pregunta actual. */
export function preguntaActual(intento: IntentoQuiz): number | undefined {
  return intento.cola[intento.pos];
}

/** Aplica la respuesta a la pregunta actual. No avanza: eso lo hace `siguiente`. */
export function registrarRespuesta(intento: IntentoQuiz, correcta: boolean): IntentoQuiz {
  if (estadoIntento(intento) !== 'jugando') return intento;
  if (correcta) return { ...intento, aciertos: intento.aciertos + 1 };
  const vidas = intento.vidas - 1;
  const actual = preguntaActual(intento);
  return {
    ...intento,
    vidas,
    errores: intento.errores + 1,
    falladas:
      actual !== undefined && !intento.falladas.includes(actual)
        ? [...intento.falladas, actual]
        : intento.falladas,
    // Sin vidas ya no hay que repetirla: el intento terminó.
    cola: vidas > 0 && actual !== undefined ? [...intento.cola, actual] : intento.cola,
  };
}

export function siguiente(intento: IntentoQuiz): IntentoQuiz {
  return { ...intento, pos: Math.min(intento.pos + 1, intento.cola.length - 1) };
}

export function estadoIntento(intento: IntentoQuiz): EstadoIntento {
  if (intento.vidas <= 0) return 'perdido';
  if (intento.total > 0 && intento.aciertos >= intento.total) return 'completado';
  return 'jugando';
}

/** Porcentaje de respuestas correctas sobre todas las enviadas (0..100). */
export function precision(intento: IntentoQuiz): number {
  const enviadas = intento.aciertos + intento.errores;
  return enviadas > 0 ? Math.round((intento.aciertos / enviadas) * 100) : 0;
}
