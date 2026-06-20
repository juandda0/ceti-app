// data/badges.ts — Logros del sistema Ceti
import { WORLD_COMPETENCIAS } from '@features/learning/data/competencias';
import { MASTERY_THRESHOLD } from '@features/learning/data/mastery';
import type { WorldId } from '@features/learning/data/quiz.types';

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  conditionType: BadgeConditionType;
  /** Threshold; for `world_mastery` it is a mastery percent (0..100). */
  conditionValue: number;
  /** Required for `world_mastery` badges: which world/competency it rewards. */
  worldId?: WorldId;
}

export type BadgeConditionType =
  | 'saved_cetis'
  | 'streak'
  | 'savings_decisions'
  | 'savings_goal_set'
  | 'goals_completed'
  | 'level'
  // Achievement-based (NOT time): awarded when a competency is mastered.
  | 'world_mastery';

// One mastery badge per competency (achievement-based, not time-based).
const WORLD_MASTERY_BADGES: Badge[] = (Object.keys(WORLD_COMPETENCIAS) as WorldId[]).map(
  (worldId) => {
    const comp = WORLD_COMPETENCIAS[worldId];
    return {
      id: `mastery_${comp.id}`,
      name: `Maestría: ${comp.label}`,
      emoji: '🎯',
      description: `Dominaste la competencia de ${comp.label}`,
      conditionType: 'world_mastery',
      conditionValue: Math.round(MASTERY_THRESHOLD * 100),
      worldId,
    };
  }
);

export const BADGES: Badge[] = [
  {
    id: 'first_save',
    name: 'Primer Ahorrador',
    emoji: '🐷',
    description: 'Ahorraste Cetis por primera vez',
    conditionType: 'saved_cetis',
    conditionValue: 1,
  },
  {
    id: 'streak_3',
    name: '3 Días Seguidos',
    emoji: '🔥',
    description: 'Entraste 3 días consecutivos',
    conditionType: 'streak',
    conditionValue: 3,
  },
  {
    id: 'streak_7',
    name: 'Una Semana Entera',
    emoji: '🌟',
    description: 'Entraste 7 días seguidos',
    conditionType: 'streak',
    conditionValue: 7,
  },
  {
    id: 'smart_spender',
    name: 'Comprador Inteligente',
    emoji: '🧠',
    description: 'Elegiste ahorrar en vez de gastar 3 veces',
    conditionType: 'savings_decisions',
    conditionValue: 3,
  },
  {
    id: 'goal_setter',
    name: 'Soñador',
    emoji: '🎯',
    description: 'Creaste tu primera meta de ahorro',
    conditionType: 'savings_goal_set',
    conditionValue: 1,
  },
  {
    id: 'goal_reached',
    name: 'Cumplidor',
    emoji: '🏆',
    description: 'Alcanzaste tu meta de ahorro',
    conditionType: 'goals_completed',
    conditionValue: 1,
  },
  {
    id: 'level_3',
    name: 'Planificador',
    emoji: '📊',
    description: 'Llegaste al nivel 3',
    conditionType: 'level',
    conditionValue: 3,
  },
  ...WORLD_MASTERY_BADGES,
];
