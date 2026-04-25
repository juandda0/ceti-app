// data/badges.ts — Logros del sistema Ceti

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  conditionType: BadgeConditionType;
  conditionValue: number;
}

export type BadgeConditionType =
  | 'lessons_completed'
  | 'saved_cetis'
  | 'streak'
  | 'savings_decisions'
  | 'savings_goal_set'
  | 'goals_completed'
  | 'level';

export const BADGES: Badge[] = [
  {
    id: 'first_lesson',
    name: 'Primera Lección',
    emoji: '📖',
    description: 'Completaste tu primera lección',
    conditionType: 'lessons_completed',
    conditionValue: 1,
  },
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
    id: 'all_lessons',
    name: 'Maestro Ceti',
    emoji: '🎓',
    description: 'Completaste todas las lecciones',
    conditionType: 'lessons_completed',
    conditionValue: 5,
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
];
