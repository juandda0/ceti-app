// data/levels.ts — Sistema de niveles de Ceti

export interface Level {
  level: number;
  name: string;
  xpRequired: number;
  xpToNext: number;
  color: string;
  emoji: string;
}

export const LEVELS: Level[] = [
  { level: 1, name: 'Aprendiz',      xpRequired: 0,    xpToNext: 100,  color: '#95A5A6', emoji: '🌱' },
  { level: 2, name: 'Ahorrador',     xpRequired: 100,  xpToNext: 250,  color: '#3498DB', emoji: '💧' },
  { level: 3, name: 'Planificador',  xpRequired: 350,  xpToNext: 400,  color: '#2ECC71', emoji: '🌿' },
  { level: 4, name: 'Inversionista', xpRequired: 750,  xpToNext: 600,  color: '#F39C12', emoji: '⭐' },
  { level: 5, name: 'Experto Ceti',  xpRequired: 1350, xpToNext: 999,  color: '#9B59B6', emoji: '👑' },
];

/**
 * Calcula el nivel actual dado un total de XP
 */
export function getLevelForXP(xp: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xpRequired) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}

/**
 * Calcula el progreso (0-1) dentro del nivel actual
 */
export function getLevelProgress(xp: number): number {
  const currentLevel = getLevelForXP(xp);
  const xpIntoLevel = xp - currentLevel.xpRequired;
  return Math.min(xpIntoLevel / currentLevel.xpToNext, 1);
}
