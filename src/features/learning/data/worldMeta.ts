/**
 * Canonical static metadata of the DEFAULT worlds (D-ORQ: these are the
 * defaults a class starts from; the professor curates per course). Single
 * source for name/color/icon — screens should import from here instead of
 * keeping local copies.
 */
import type { WorldId } from '@features/learning/data/quiz.types';

export interface WorldDef {
  id: WorldId;
  number: number;
  name: string;
  subtitle: string;
  description: string;
  iconName: 'planet' | 'moon' | 'star' | 'infinite' | 'warning' | 'rocket';
  color: string;
}

/** Custom worlds (RQ-PR12) render with a fixed accent + rocket icon. */
export const CUSTOM_WORLD_COLOR = '#4FB6C9';

export function isCustomWorldId(worldId: string): boolean {
  return worldId.startsWith('cw_');
}

export const WORLD_DEFS: readonly WorldDef[] = [
  {
    id: 'world_1',
    number: 1,
    name: 'Planeta Origen',
    subtitle: 'El dinero y yo',
    description: 'Qué es el dinero, cómo funciona y tus primeras decisiones financieras.',
    iconName: 'planet',
    color: '#FF8A1F',
  },
  {
    id: 'world_2',
    number: 2,
    name: 'Luna del Presupuesto',
    subtitle: 'Controlar lo que entra y sale',
    description: 'Presupuesto personal, regla 50/30/20 y fondo de emergencia.',
    iconName: 'moon',
    color: '#F7C95F',
  },
  {
    id: 'world_3',
    number: 3,
    name: 'Estrella del Ahorro',
    subtitle: 'Guardar con propósito',
    description: 'Metas SMART, interés compuesto y hábitos de ahorro efectivos.',
    iconName: 'star',
    color: '#58C88C',
  },
  {
    id: 'world_4',
    number: 4,
    name: 'Nebulosa del Crédito',
    subtitle: 'Usar el crédito sin que te use',
    description: 'Tarjetas, historial crediticio y cuándo endeudarse tiene sentido.',
    iconName: 'infinite',
    color: '#A884FF',
  },
  {
    id: 'world_5',
    number: 5,
    name: 'Agujero Negro de las Deudas',
    subtitle: 'Salir de las deudas',
    description: 'Métodos avalancha y bola de nieve para liberarte de deudas.',
    iconName: 'warning',
    color: '#5B9EF5',
  },
] as const;

export function worldDefById(worldId: string): WorldDef | undefined {
  return WORLD_DEFS.find((d) => d.id === worldId);
}

/**
 * Display metadata for ANY world of a class: a default world merged with the
 * professor's display overrides, or a custom (`cw_*`) world built from its
 * config entry. Returns null for an unknown id (defensive — never crash the
 * student's screen).
 */
export function displayWorldDef(
  worldId: string,
  entry?: { nombre?: string; subtitle?: string; descripcion?: string } | null
): WorldDef | null {
  const base = worldDefById(worldId);
  if (base) {
    if (!entry) return base;
    return {
      ...base,
      name: entry.nombre ?? base.name,
      subtitle: entry.subtitle ?? base.subtitle,
      description: entry.descripcion ?? base.description,
    };
  }
  if (!isCustomWorldId(worldId) || !entry?.nombre) return null;
  return {
    id: worldId,
    number: 0, // callers override with the class-order position
    name: entry.nombre,
    subtitle: entry.subtitle ?? '',
    description: entry.descripcion ?? '',
    iconName: 'rocket',
    color: CUSTOM_WORLD_COLOR,
  };
}
