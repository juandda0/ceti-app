/**
 * Tipos y constantes del panel parental (sin datos de prueba).
 */
export interface ChildDashboardSummary {
  id: string;
  nickname: string;
  fullName: string;
  age: number;
  avatarEmoji: string;
  xp: number;
  streak: number;
  totalSaved: number;
  totalLessons: number;
  pendingDeposits: number;
  accuracy: number;
  savingsHistory: number[];
  educationHistory: number[];
}

/** Mapa opcional para sobreescribir hijos en pruebas; en producción suele estar vacío. */
export const OVERRIDE_CHILDREN: Record<string, ChildDashboardSummary> = {};

export const WEEK_LABELS = ['S-7', 'S-6', 'S-5', 'S-4', 'S-3', 'S-2', 'S-1', 'Hoy'];

export const DEFAULT_SAVINGS_WEEKS: Record<string, number[]> = {
  all: [0, 0, 0, 0, 0, 0, 0, 0],
};
