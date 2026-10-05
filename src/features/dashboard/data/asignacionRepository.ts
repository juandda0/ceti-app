import { api, isBackendConfigured, seg } from '@shared/lib/api/client';
import { cursoPath } from '@shared/lib/api/paths';
import type { AsignacionAny } from '@shared/types/tenancy';

export type AsignacionWithId = AsignacionAny & { id: string };

/**
 * Assignments: a mundo brief ("complete World X before date Y") or a reto
 * financiero (RQ-PR14). Staff create; members read. `kind` discriminates. The
 * backend filters by caller: the teacher gets the whole course, a student only
 * course-wide ones plus those targeted at them.
 */
export const asignacionRepository = {
  async create(colegioId: string, asignacion: AsignacionAny): Promise<boolean> {
    if (!isBackendConfigured()) return false;
    await api.post(`/api/colegios/${seg(colegioId)}/asignaciones`, asignacion);
    return true;
  },
  async listByCurso(colegioId: string, cursoId: string): Promise<AsignacionWithId[]> {
    if (!isBackendConfigured()) return [];
    return api.get<AsignacionWithId[]>(`${cursoPath(colegioId, cursoId)}/asignaciones`);
  },
  async listForStudent(colegioId: string, cursoId: string): Promise<AsignacionWithId[]> {
    return this.listByCurso(colegioId, cursoId);
  },
};
