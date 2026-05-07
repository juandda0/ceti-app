import type { IoniconsName } from '@shared/types/ionicons';

export type WorldId = 'rocky' | 'sprout' | 'metro';

export interface IslandShape {
  /** Ancho total de la isla en unidades de pantalla relativas (0–1) */
  widthFactor: number;
  /** Altura total de la isla (px) */
  height: number;
  /** Altura de la cúpula (parte superior) */
  domeHeight: number;
  /** Profundidad de las estalactitas inferiores */
  stalactiteDepth: number;
  /** Número de estalactitas en la parte inferior */
  stalactiteCount: number;
  /** Seed determinista para el jagged inferior */
  jaggedSeed: number;
}

export interface IslandSprites {
  /** Posición relativa del cohete sobre la isla (0–1 de ancho de isla) */
  rocketX: number;
  /** Altura desde la cima de la isla (px) */
  rocketYOffset: number;
  /** Hotspot del cráter / árbol / edificio especial */
  specialHotspot: { xFactor: number; yFactor: number };
}

export interface WorldDefinition {
  id: WorldId;
  name: string;
  subtitle: string;
  costCetis: number;
  icon: IoniconsName;
  unlockMessage: string;
  starCount: number;
  shape: IslandShape;
  sprites: IslandSprites;
}

export const WORLDS: Record<WorldId, WorldDefinition> = {
  rocky: {
    id: 'rocky',
    name: 'Roca Solitaria',
    subtitle: 'Tu primer hogar en el cosmos',
    costCetis: 0,
    icon: 'planet-outline',
    unlockMessage: 'Bienvenido a tu primer mundo',
    starCount: 45,
    shape: {
      widthFactor: 0.7,
      height: 260,
      domeHeight: 100,
      stalactiteDepth: 100,
      stalactiteCount: 7,
      jaggedSeed: 42,
    },
    sprites: {
      rocketX: 0.84,
      rocketYOffset: -22,
      specialHotspot: { xFactor: 0.3, yFactor: 0.45 },
    },
  },
  sprout: {
    id: 'sprout',
    name: 'Brote Verde',
    subtitle: 'La vida florece con tus ahorros',
    costCetis: 500,
    icon: 'leaf-outline',
    unlockMessage: '¡Lo lograste! Tu mundo floreció',
    starCount: 12,
    shape: {
      widthFactor: 0.8,
      height: 300,
      domeHeight: 120,
      stalactiteDepth: 120,
      stalactiteCount: 8,
      jaggedSeed: 77,
    },
    sprites: {
      rocketX: 0.86,
      rocketYOffset: -24,
      specialHotspot: { xFactor: 0.28, yFactor: 0.38 },
    },
  },
  metro: {
    id: 'metro',
    name: 'Metrópolis Ceti',
    subtitle: 'El futuro del ahorro inteligente',
    costCetis: 2000,
    icon: 'business-outline',
    unlockMessage: '¡Eres un maestro del ahorro!',
    starCount: 65,
    shape: {
      widthFactor: 0.88,
      height: 340,
      domeHeight: 140,
      stalactiteDepth: 140,
      stalactiteCount: 9,
      jaggedSeed: 113,
    },
    sprites: {
      rocketX: 0.88,
      rocketYOffset: -26,
      specialHotspot: { xFactor: 0.32, yFactor: 0.35 },
    },
  },
};

const ORDER: WorldId[] = ['rocky', 'sprout', 'metro'];

export function getNextWorld(id: WorldId): WorldDefinition | null {
  const i = ORDER.indexOf(id);
  const nid = ORDER[i + 1];
  return nid ? WORLDS[nid] : null;
}
