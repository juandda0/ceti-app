/**
 * Decisión de escritura de la señal de reto (RQ-PR14): evalúa el reto contra el
 * diario LOCAL y decide si publicar una transición. Monotónico: solo avanza
 * (sin_empezar → en_progreso → cumplido), nunca regresa ni reescribe el mismo
 * estado. `sin_empezar` nunca se escribe (= ausencia del doc). El payload es
 * incapaz de llevar datos del diario: solo estado + timestamps.
 */
import type { RetoEstado, RetoEstadoDoc } from '@shared/types/tenancy';
import {
  evaluarReto,
  type DiarioLocal,
  type RetoConsigna,
} from '@features/dashboard/data/retoEvaluator';

export interface RetoAsignado extends RetoConsigna {
  id: string;
}

/** Último estado publicado conocido (caché local); null = desconocido. */
export type RetoEstadoLocal = RetoEstado | 'sin_empezar' | null;

export interface RetoCoords {
  colegioId: string;
  cursoId: string;
  uid: string;
}

export function decidirEscritura(
  reto: RetoAsignado,
  diario: DiarioLocal,
  prev: RetoEstadoLocal,
  coords: RetoCoords,
  now: number = Date.now()
): RetoEstadoDoc | null {
  const { estado } = evaluarReto(reto, diario, now);
  if (estado === 'sin_empezar') return null; // la ausencia del doc = sin_empezar
  if (prev === 'cumplido') return null; // estado terminal, no se reescribe
  if (prev === estado) return null; // sin cambio → sin escritura

  const doc: RetoEstadoDoc = {
    colegioId: coords.colegioId,
    cursoId: coords.cursoId,
    uid: coords.uid,
    retoId: reto.id,
    estado,
    updatedAt: now,
  };
  if (estado === 'cumplido') doc.cumplidoAt = now;
  return doc;
}
