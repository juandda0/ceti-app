/**
 * Ritmo real de una meta: promedio mensual de los depósitos de los últimos 90
 * días y proyección de meses restantes (reusa monthsToReach de lifeProjects).
 * Derivado en cliente, no se persiste (R5). RQ-ES11-CA4. Puro.
 */
import type { SavingsDeposit, SavingsGoal } from '@features/savings/store/useSavingsStore';
import { monthsToReach } from '@features/savings/data/lifeProjects';

const VENTANA_MS = 90 * 24 * 60 * 60 * 1000;
const MES_MS = 30 * 24 * 60 * 60 * 1000;

export function ritmoMeta(
  goal: SavingsGoal,
  deposits: SavingsDeposit[],
  now: number = Date.now()
): { ritmoMensual: number; mesesAlRitmo: number | null } {
  const desde = now - VENTANA_MS;
  const total = deposits
    .filter((d) => d.goalId === goal.id && d.createdAt >= desde)
    .reduce((acc, d) => acc + d.amount, 0);

  const ritmoMensual = Math.round((total / VENTANA_MS) * MES_MS);
  const restante = goal.targetAmount - goal.currentAmount;
  const mesesAlRitmo =
    restante <= 0 ? 0 : monthsToReach(goal.targetAmount, goal.currentAmount, ritmoMensual);

  return { ritmoMensual, mesesAlRitmo };
}
