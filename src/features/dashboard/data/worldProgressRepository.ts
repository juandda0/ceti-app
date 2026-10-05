import { api, isBackendConfigured, seg } from '@shared/lib/api/client';
import { estudiantePath } from '@shared/lib/api/paths';
import type { WorldProgress } from '@shared/types/tenancy';

/**
 * Tenant-tree progress: students write their own (the backend gates it to
 * estado=='activo'); teachers read it for the dashboard.
 */
export const worldProgressRepository = {
  async upsert(
    colegioId: string,
    cursoId: string,
    uid: string,
    worldId: string,
    progress: WorldProgress
  ): Promise<boolean> {
    if (!isBackendConfigured()) return false;
    await api.put(`${estudiantePath(colegioId, cursoId, uid)}/progress/${seg(worldId)}`, progress);
    return true;
  },
  /** Each entry carries its `worldId` so callers can rehydrate per-world state. */
  async getStudentProgress(
    colegioId: string,
    cursoId: string,
    uid: string
  ): Promise<(WorldProgress & { worldId: string })[]> {
    if (!isBackendConfigured()) return [];
    return api.get(`${estudiantePath(colegioId, cursoId, uid)}/progress`);
  },
};
