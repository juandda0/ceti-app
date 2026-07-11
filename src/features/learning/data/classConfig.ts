/**
 * Class-config resolution (D-ORQ, RQ-PR10). Pure logic — no Firebase here.
 *
 * The professor's config doc (`cursos/{cursoId}/config/mundos`) decides which
 * worlds a class sees and in which order. ABSENCE of the doc (or a malformed one
 * from a stale cache) resolves to the defaults, which is exactly the pre-D-ORQ
 * behavior — that is the zero-migration guarantee.
 */
import type { CursoConfigMundos } from '@shared/types/tenancy';
import { WORLD_ORDER } from '@features/learning/data/competencias';

export interface ClassWorldView {
  worldId: string;
  unlocked: boolean;
}

export interface ResolvedClassWorlds {
  /** Visible worlds in teaching order (already filtered by activo). */
  worlds: ClassWorldView[];
}

function defaultEntries(): { worldId: string; activo: boolean }[] {
  return WORLD_ORDER.map((worldId) => ({ worldId, activo: true }));
}

/** Active entries in teaching order. */
function resolveActive(
  config: CursoConfigMundos | null | undefined
): { worldId: string; activo: boolean }[] {
  const entries = config?.mundos?.length ? config.mundos : defaultEntries();
  return entries.filter((e) => e && e.activo && typeof e.worldId === 'string');
}

/**
 * Resolves what a student sees. Unlock rule (RQ-PR10 CA5): an active world is
 * unlocked if it was already completed OR every active world before it in the
 * order is completed — completion is never re-locked by reordering.
 */
export function resolveClassWorlds(
  config: CursoConfigMundos | null | undefined,
  isCompleted: (worldId: string) => boolean
): ResolvedClassWorlds {
  const active = resolveActive(config);

  let allPreviousCompleted = true;
  const worlds: ClassWorldView[] = active.map((entry) => {
    const unlocked = isCompleted(entry.worldId) || allPreviousCompleted;
    allPreviousCompleted = allPreviousCompleted && isCompleted(entry.worldId);
    return { worldId: entry.worldId, unlocked };
  });

  return { worlds };
}

/**
 * Next config doc for a curation action of the manager (toggle/reorder/focus).
 * CRITICAL: it must carry over `overrides` — they are the source of truth of
 * the copy-on-write content (RQ-PR11); dropping them silently reverts the
 * professor's edits and breaks custom worlds. Version bumps to invalidate the
 * students' quiz cache.
 */
export function buildCuratedConfig(
  config: CursoConfigMundos | null,
  mundos: CursoConfigMundos['mundos'],
  uid: string,
  now: number
): CursoConfigMundos {
  return {
    mundos,
    ...(config?.overrides ? { overrides: config.overrides } : {}),
    version: (config?.version ?? 0) + 1,
    updatedAt: now,
    updatedByUid: uid,
  };
}

/**
 * Whether a world is part of what the class currently serves (activo + focus),
 * IGNORING the unlock chain. This is the saga entry guard (RQ-PR10 CA4): it
 * only depends on the config — never on progress hydration — so a deep link
 * into a hidden/removed world bounces deterministically.
 */
export function isWorldVisible(
  config: CursoConfigMundos | null | undefined,
  worldId: string
): boolean {
  return resolveActive(config).some((e) => e.worldId === worldId);
}

/** Whether a student may ENTER a world right now (visibility + unlock chain). */
export function isWorldAccessible(
  config: CursoConfigMundos | null | undefined,
  worldId: string,
  isCompleted: (worldId: string) => boolean
): boolean {
  const { worlds } = resolveClassWorlds(config, isCompleted);
  return worlds.some((w) => w.worldId === worldId && w.unlocked);
}
