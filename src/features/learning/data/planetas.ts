/**
 * Planeta de cada mundo en Tu Galaxia. Los planetas son genéricos (espacio + plata, sin tema), así que
 * cualquier planeta sirve para cualquier mundo: los 6 por defecto tienen el suyo y los mundos del
 * profesor (`cw_*`) toman los de reserva por turno, según su posición en la clase.
 */
import type { AnimationId } from '@features/animations';
import { isCustomWorldId } from '@features/learning/data/worldMeta';

export interface Planeta {
  animacion: AnimationId;
  /** Acento legible sobre el fondo espacial (etiquetas, borde de la tarjeta, progreso). */
  acento: string;
  /** Sombra del botón/borde inferior en el mismo tono. */
  acentoOscuro: string;
}

const PLANETAS = {
  naranja: { animacion: 'mundos.naranja', acento: '#FF9F45', acentoOscuro: '#C25E08' },
  lila: { animacion: 'mundos.lila', acento: '#C4A8F0', acentoOscuro: '#7E5FB8' },
  menta: { animacion: 'mundos.menta', acento: '#6FD3A0', acentoOscuro: '#3E9A6E' },
  morado: { animacion: 'mundos.morado', acento: '#C98BE8', acentoOscuro: '#814299' },
  azul: { animacion: 'mundos.azul', acento: '#6FB2F2', acentoOscuro: '#2A72B1' },
  turquesa: { animacion: 'mundos.turquesa', acento: '#4FCBC5', acentoOscuro: '#187374' },
  rosado: { animacion: 'mundos.rosado', acento: '#FFA7B5', acentoOscuro: '#DF7889' },
  coral: { animacion: 'mundos.coral', acento: '#FF8A75', acentoOscuro: '#D84A36' },
} as const satisfies Record<string, Planeta>;

const POR_MUNDO: Record<string, Planeta> = {
  world_1: PLANETAS.naranja,
  world_2: PLANETAS.lila,
  world_3: PLANETAS.menta,
  world_4: PLANETAS.morado,
  world_5: PLANETAS.azul,
  world_6: PLANETAS.turquesa,
};

const RESERVA: readonly Planeta[] = [PLANETAS.rosado, PLANETAS.coral, PLANETAS.turquesa];

/** `posicion`: índice del mundo en la clase (0..n-1); reparte la reserva entre los mundos del profesor. */
export function planetaDeMundo(worldId: string, posicion: number): Planeta {
  const propio = POR_MUNDO[worldId];
  if (propio) return propio;
  if (isCustomWorldId(worldId)) return RESERVA[posicion % RESERVA.length];
  return PLANETAS.naranja;
}
