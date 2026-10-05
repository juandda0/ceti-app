import { api, isBackendConfigured } from '@shared/lib/api/client';
import { cursoPath } from '@shared/lib/api/paths';
import { recordError } from '@shared/lib/analytics/errorReporting';
import type { CursoConfigMundos } from '@shared/types/tenancy';

// ponytail: sondeo cada 15 s en vez del onSnapshot de Firestore; upgrade path:
// SSE/WebSocket desde el backend si la clase necesita cambios instantáneos.
const POLL_MS = 15_000;

function configPath(colegioId: string, cursoId: string): string {
  return `${cursoPath(colegioId, cursoId)}/config`;
}

// Refrescos activos por curso: una escritura propia se ve al instante (como la
// compensación local de Firestore) en vez de esperar al siguiente sondeo.
const refreshers = new Map<string, Set<() => void>>();

/**
 * Class configuration (D-ORQ, RQ-PR10): written only by the course's profesor
 * (enforced by the backend); students follow it via polling. `null` everywhere
 * means "no config" → callers resolve to defaults (see classConfig.ts), so
 * offline degrades to the pre-D-ORQ behavior.
 */
export const classConfigRepository = {
  async get(colegioId: string, cursoId: string): Promise<CursoConfigMundos | null> {
    if (!isBackendConfigured()) return null;
    return api.getOrNull<CursoConfigMundos>(configPath(colegioId, cursoId));
  },
  /**
   * Live-ish subscription (the student's channel to the teacher's edits).
   * Errors (offline, permission) resolve to `null` → defaults; never throws into
   * the UI. Only notifies when the config actually changed.
   */
  subscribe(
    colegioId: string,
    cursoId: string,
    onConfig: (config: CursoConfigMundos | null) => void
  ): () => void {
    if (!isBackendConfigured()) {
      onConfig(null);
      return () => {};
    }
    let active = true;
    let last: string | undefined;
    const tick = async () => {
      let config: CursoConfigMundos | null = null;
      try {
        config = await this.get(colegioId, cursoId);
      } catch (e) {
        recordError(e, 'class_config_poll');
      }
      const snapshot = JSON.stringify(config);
      if (active && snapshot !== last) {
        last = snapshot;
        onConfig(config);
      }
    };
    const key = configPath(colegioId, cursoId);
    const refresh = () => void tick();
    const set = refreshers.get(key) ?? new Set();
    set.add(refresh);
    refreshers.set(key, set);
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
      set.delete(refresh);
      if (set.size === 0) refreshers.delete(key);
    };
  },
  /** Re-lee la config ya mismo en las pantallas suscritas a este curso. */
  notifyChanged(colegioId: string, cursoId: string): void {
    refreshers.get(configPath(colegioId, cursoId))?.forEach((refresh) => refresh());
  },
  async upsert(colegioId: string, cursoId: string, config: CursoConfigMundos): Promise<boolean> {
    if (!isBackendConfigured()) return false;
    await api.put(configPath(colegioId, cursoId), config);
    this.notifyChanged(colegioId, cursoId);
    return true;
  },
  /** "Restaurar configuración": deleting the doc restores the defaults. */
  async reset(colegioId: string, cursoId: string): Promise<boolean> {
    if (!isBackendConfigured()) return false;
    await api.del(configPath(colegioId, cursoId));
    this.notifyChanged(colegioId, cursoId);
    return true;
  },
};
