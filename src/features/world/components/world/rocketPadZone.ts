// rocketPadZone.ts — Zona de despeje exclusiva alrededor del cohete (sin decoración encima)
import type { WorldId } from '../../data/worlds';
import { WORLDS } from '../../data/worlds';
import { ROCKET_DIMS } from './rocketSkia';

/** Margen horizontal respecto al ancho dibujado del cohete + aletas */
const PAD_X = 46;
/** Margen sobre la nariz y bajo la llama */
const PAD_TOP = 54;
const PAD_BOTTOM = 52;
/** Altura aproximada de la llama bajo la base (px, coherente con rocketSkia) */
const FLAME_EXTENT = 34;

export interface RocketPadZone {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
}

/** Misma fórmula que WorldCanvas / WorldRocket para la base del cohete */
export function computeRocketPadZone(
  islandCx: number,
  islandCy: number,
  islandW: number,
  worldId: WorldId
): RocketPadZone {
  const { rocketX, rocketYOffset } = WORLDS[worldId].sprites;
  const rcx = islandCx + (rocketX - 0.5) * islandW;
  const baseY = islandCy - ROCKET_DIMS.bodyH - 18 + rocketYOffset;
  const halfW = ROCKET_DIMS.width / 2 + PAD_X;
  return {
    cx: rcx,
    left: rcx - halfW,
    right: rcx + halfW,
    top: baseY - ROCKET_DIMS.bodyH - PAD_TOP,
    bottom: baseY + FLAME_EXTENT + PAD_BOTTOM,
  };
}

export function circleHitsRocketZone(px: number, py: number, r: number, z: RocketPadZone): boolean {
  return px + r >= z.left && px - r <= z.right && py + r >= z.top && py - r <= z.bottom;
}

export function pointHitsRocketZone(px: number, py: number, z: RocketPadZone): boolean {
  return px >= z.left && px <= z.right && py >= z.top && py <= z.bottom;
}

/** Rectángulo horizontal [x0,x1] en Y ≈ surface (para casas, troncos, etc.) */
export function hBandHitsRocketZone(
  x0: number,
  x1: number,
  y: number,
  z: RocketPadZone,
  halfThickness = 24
): boolean {
  const t = y - halfThickness;
  const b = y + halfThickness;
  if (b < z.top || t > z.bottom) return false;
  return x1 >= z.left && x0 <= z.right;
}

/** Rectángulo axis-aligned (left, top, right, bottom) en coords de pantalla */
export function rectOverlapsRocketZone(
  left: number,
  top: number,
  right: number,
  bottom: number,
  z: RocketPadZone
): boolean {
  return right >= z.left && left <= z.right && bottom >= z.top && top <= z.bottom;
}
