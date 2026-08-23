/**
 * Ritmo real de una meta: promedio neto mensual de sus operaciones de los últimos 90
 * días y proyección de meses restantes (reusa monthsToReach de lifeProjects).
 * Derivado en cliente, no se persiste (R5). RQ-ES11-CA4. Puro.
 */
import type { SavingsGoal, SavingsOperation } from '@features/savings/domain/savings';
import { projectSavings } from '@features/savings/domain/savings';
import { monthsToReach } from '@features/savings/data/lifeProjects';

const VENTANA_MS = 90 * 24 * 60 * 60 * 1000;
const MES_MS = 30 * 24 * 60 * 60 * 1000;

export function ritmoMeta(
  goal: SavingsGoal,
  operations: SavingsOperation[],
  now: number = Date.now()
): { ritmoMensual: number; mesesAlRitmo: number | null } {
  const desde = now - VENTANA_MS;
  const total = operations
    .filter((operation) => operation.goalId === goal.id && operation.fecha >= desde)
    .reduce(
      (acc, operation) =>
        acc + (operation.type === 'aporte' ? operation.amount : -operation.amount),
      0
    );

  const ritmoMensual = Math.max(0, Math.round((total / VENTANA_MS) * MES_MS));
  const currentAmount = projectSavings([goal], operations).byGoal[goal.id] ?? 0;
  const restante = goal.targetAmount - currentAmount;
  const mesesAlRitmo =
    restante <= 0 ? 0 : monthsToReach(goal.targetAmount, currentAmount, ritmoMensual);

  return { ritmoMensual, mesesAlRitmo };
}
