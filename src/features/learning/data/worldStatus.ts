import { MASTERY_THRESHOLD } from '@features/learning/data/mastery';

/**
 * Ciclo de vida de un mundo para un estudiante, derivado de si está desbloqueado
 * y de su ratio de aciertos (done/total). `dominado` usa el mismo umbral que
 * isMastered/isWorldComplete — un mundo se domina al alcanzarlo, no al 100%.
 */
export type WorldStatus = 'bloqueado' | 'disponible' | 'en_progreso' | 'dominado';

export function worldStatus(unlocked: boolean, ratio: number): WorldStatus {
  if (!unlocked) return 'bloqueado';
  if (ratio >= MASTERY_THRESHOLD) return 'dominado';
  if (ratio > 0) return 'en_progreso';
  return 'disponible';
}
