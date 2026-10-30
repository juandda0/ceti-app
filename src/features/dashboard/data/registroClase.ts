/**
 * Lo que un estudiante le manda a su clase (Fase 1). Solo se escribe desde el
 * espacio de esa clase y con la autorización confirmada (las reglas lo exigen),
 * así que el profe ve lo que pasó desde que el estudiante se unió, nunca lo de
 * "Mi galaxia". Vive bajo `colegios/{cid}/cursos/{k}/estudiantes/{uid}/`:
 *
 * - `intentos/{id}`: una lección o un intento de jefe, ganado o perdido, con
 *   cada respuesta (pregunta, si acertó, qué eligió, cuánto tardó). Un doc por
 *   intento, no por respuesta, para que Firestore no cueste de más.
 * - `visitas/{día}`: cuántas veces abrió el espacio de la clase ese día.
 * - `resumen/orbita`: su racha y sus XP (de la cuenta), para el nivel en la ficha.
 *
 * Puro: aquí solo se arman los documentos; `registroClaseRepository` los escribe.
 */
import type { RegistroLeccion } from '@features/learning/screens/LeccionScreen';

export const MAX_RESPUESTAS_POR_INTENTO = 40;
/** Un intento de más de 2 h es una app que quedó abierta: se recorta. */
export const MAX_DURACION_MS = 2 * 60 * 60 * 1000;
/** Una pregunta de más de 10 min igual: se recorta. */
export const MAX_MS_RESPUESTA = 10 * 60 * 1000;
/** Visitas: como mucho una cada 30 min. */
export const MIN_ENTRE_VISITAS_MS = 30 * 60 * 1000;

export interface RespuestaIntento {
  /** Id de la pregunta. */
  p: string;
  /** Tipo: multiple_choice, true_false u ordenar. */
  t: string;
  ok: boolean;
  /** Lo que eligió (texto de la opción, verdadero/falso, u orden "2-0-1"). */
  r: string;
  ms: number;
}

export interface IntentoClase {
  worldId: string;
  tipo: 'leccion' | 'jefe';
  /** Lección del mapa (0..); null en el jefe. */
  nivel: number | null;
  resultado: 'completado' | 'perdido';
  inicioAt: number;
  finAt: number;
  duracionMs: number;
  /** Respuestas dadas (las falladas vuelven a la cola, así que puede pasar del número de preguntas). */
  total: number;
  aciertos: number;
  respuestas: RespuestaIntento[];
}

export function construirIntento(input: {
  worldId: string;
  tipo: 'leccion' | 'jefe';
  nivel: number;
  registro: RegistroLeccion;
}): IntentoClase {
  const { registro } = input;
  const respuestas = registro.respuestas.slice(0, MAX_RESPUESTAS_POR_INTENTO).map((r) => ({
    p: r.pregunta.slice(0, 120),
    t: r.tipo,
    ok: r.correcta,
    r: r.respuesta.slice(0, 80),
    ms: Math.min(MAX_MS_RESPUESTA, Math.max(0, Math.round(r.ms))),
  }));
  const finAt = Math.max(registro.finAt, registro.inicioAt);
  return {
    worldId: input.worldId,
    tipo: input.tipo,
    nivel: input.tipo === 'leccion' ? input.nivel : null,
    resultado: registro.resultado,
    inicioAt: registro.inicioAt,
    finAt,
    duracionMs: Math.min(MAX_DURACION_MS, finAt - registro.inicioAt),
    total: respuestas.length,
    aciertos: respuestas.filter((r) => r.ok).length,
    respuestas,
  };
}

/** Día local "AAAA-MM-DD" (Colombia no cambia de hora). */
export function diaDe(ahora: number): string {
  const d = new Date(ahora);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** ¿Ya pasó lo suficiente desde la última visita registrada para contar otra? */
export function cuentaComoVisita(ultimaAt: number | null | undefined, ahora: number): boolean {
  return ultimaAt == null || ahora - ultimaAt >= MIN_ENTRE_VISITAS_MS;
}

export interface ResumenOrbitaClase {
  xpTotal: number;
  racha: number;
  mejorRacha: number;
  diasAprendiendo: number;
  actualizadoAt: number;
}
