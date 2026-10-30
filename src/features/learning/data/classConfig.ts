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
import {
  faltantesRequisitos,
  leerRequisitos,
  type FaltaRequisito,
} from '@/functions/src/educadores/dominio/requisitosMundo';
import type { EscalaSiee } from '@/functions/src/educadores/dominio/notas1290';

export interface ClassWorldView {
  worldId: string;
  unlocked: boolean;
  /** Fase 9: requisitos del profe que aún no cumple (vacío o ausente = ninguno). */
  faltan?: FaltaRequisito[];
}

/** Fase 9: lo que hace falta para evaluar los requisitos de cada mundo. */
export interface ContextoClase {
  ahora: number;
  /** Maestría 0..1 del mundo en esta clase, o null sin datos. */
  maestria: (worldId: string) => number | null;
  escala?: EscalaSiee;
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
): { worldId: string; activo: boolean; requisitos?: unknown }[] {
  const entries = config?.mundos?.length ? config.mundos : defaultEntries();
  return entries.filter((e) => e && e.activo && typeof e.worldId === 'string');
}

/**
 * Resolves what a student sees. Unlock rule (RQ-PR10 CA5): an active world is
 * unlocked if it was already completed OR every active world before it in the
 * order is completed — completion is never re-locked by reordering.
 * Fase 9: with `clase`, the teacher's `requisitos` (date, prior world,
 * minimum grade) also have to be met; a completed world still never re-locks.
 */
export function resolveClassWorlds(
  config: CursoConfigMundos | null | undefined,
  isCompleted: (worldId: string) => boolean,
  clase?: ContextoClase
): ResolvedClassWorlds {
  const active = resolveActive(config);
  const visibles = new Set(active.map((e) => e.worldId));

  let allPreviousCompleted = true;
  const worlds: ClassWorldView[] = active.map((entry) => {
    const completed = isCompleted(entry.worldId);
    const faltan = clase
      ? faltantesRequisitos(leerRequisitos(entry.requisitos, clase.escala), {
          ...clase,
          visibles,
          conquistado: isCompleted,
        })
      : [];
    const unlocked = completed || (allPreviousCompleted && faltan.length === 0);
    allPreviousCompleted = allPreviousCompleted && completed;
    return { worldId: entry.worldId, unlocked, ...(faltan.length && !completed ? { faltan } : {}) };
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
