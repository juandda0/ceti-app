/**
 * Ciclo de vida de una meta de ahorro, derivado de sus montos (sin campo
 * persistido, igual que assignmentStatus).
 */
export type GoalStatus = 'activa' | 'cumplida';

export function goalStatus(g: {
  currentAmount: number;
  targetAmount: number;
  completedAt?: number;
}): GoalStatus {
  if (g.completedAt != null || (g.targetAmount > 0 && g.currentAmount >= g.targetAmount)) {
    return 'cumplida';
  }
  return 'activa';
}
