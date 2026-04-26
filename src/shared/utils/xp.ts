// utils/xp.ts — Cálculos de XP y niveles para Ceti
import { getLevelForXP, LEVELS } from '@shared/data/levels';

/**
 * XP otorgado por diferentes acciones
 */
export const XP_REWARDS = {
  LESSON_COMPLETE: 0, // Se define por lección individual
  QUIZ_PERFECT: 20,
  STREAK_DAY_3: 30,
  STREAK_DAY_7: 100,
  TASK_COMPLETE: 25,
  FIRST_SAVE: 50,
  GOAL_REACHED: 150,
} as const;

/**
 * Verifica si un XP dado causa un nivel nuevo respecto al XP anterior
 */
export function didLevelUp(previousXP: number, newXP: number): boolean {
  const previousLevel = getLevelForXP(previousXP);
  const newLevel = getLevelForXP(newXP);
  return newLevel.level > previousLevel.level;
}

/**
 * Calcula el nivel máximo posible
 */
export function getMaxLevel(): number {
  return LEVELS[LEVELS.length - 1].level;
}

/**
 * Verifica si un streak determinado otorga bonus XP
 */
export function getStreakBonusXP(streak: number): number {
  if (streak === 7) return XP_REWARDS.STREAK_DAY_7;
  if (streak === 3) return XP_REWARDS.STREAK_DAY_3;
  return 0;
}
