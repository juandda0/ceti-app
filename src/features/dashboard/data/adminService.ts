/**
 * Course operations for the profesor (D-PIVOT). Claim/auth/PII-sensitive actions
 * go through the backend (the only trusted writer of roles, roster and
 * structure — R2/R3/D-B1-03).
 */
import { api } from '@shared/lib/api/client';
import { cursoPath, estudiantePath } from '@shared/lib/api/paths';
import type { LoginIntent } from '@features/auth/data/loginIntent';

export const adminService = {
  /**
   * Lightweight Ley 1581 attestation (backend): the school confirms it
   * holds the acudiente authorization. NO acudiente PII is stored — only the
   * boolean + who/when + policy version. atestado:true activates the student.
   */
  async atestar(input: {
    colegioId: string;
    cursoId: string;
    uid: string;
    atestado: boolean;
    politicaVersion: string;
  }): Promise<{ ok: boolean; atestado: boolean }> {
    const { colegioId, cursoId, uid, ...body } = input;
    return {
      ok: true,
      ...(await api.post<{ atestado: boolean }>(
        `${estudiantePath(colegioId, cursoId, uid)}/atestacion`,
        body
      )),
    };
  },

  /**
   * Ley 1581 right to suppression (backend): deletes the student's
   * progress/impact data, marks 'suprimido' and revokes claims. Allowed to the
   * course's profesor + admin backend (irreversible).
   */
  async suppressStudent(input: {
    colegioId: string;
    cursoId: string;
    uid: string;
  }): Promise<{ ok: boolean }> {
    return api.post(`${estudiantePath(input.colegioId, input.cursoId, input.uid)}/supresion`);
  },

  /** (Re)generates the join code for a course. */
  async generateClassCode(
    colegioId: string,
    cursoId: string,
    regenerate = false
  ): Promise<{ code: string }> {
    return api.post(`${cursoPath(colegioId, cursoId)}/codigo`, { regenerate });
  },

  /** Student self-joins a course by code. */
  async joinByCode(code: string): Promise<{ ok: boolean; colegioId: string; cursoId: string }> {
    return { ok: true, ...(await api.post<{ colegioId: string; cursoId: string }>('/api/me/join', { code })) };
  },

  /**
   * Resolves the signed-in user's access on login (D-ADMIN): grants admin
   * (allowlist) or a self-registered professor.
   * Otherwise returns null role (prospective student → join by code). Idempotent.
   */
  async resolveMyAccess(requestedRole: LoginIntent | null): Promise<{
    role: 'admin' | 'profesor' | 'estudiante' | null;
    colegioId: string | null;
    cursoId: string | null;
  }> {
    return api.post('/api/me/access', requestedRole === 'profesor' ? { requestedRole } : {});
  },

  /** Admin lists all colegios for the provisioning panel. */
  async listColegios(): Promise<{
    colegios: {
      id: string;
      nombre: string;
      plan: string | null;
      planMaxEstudiantes: number | null;
    }[];
  }> {
    return api.get('/api/admin/colegios');
  },

  /** Admin creates a colegio (D-ADMIN / RQ-AD02). */
  async registerColegio(input: { colegioId: string; nombre: string }): Promise<{ ok: boolean }> {
    await api.post('/api/admin/colegios', input);
    return { ok: true };
  },

  /** Professor creates their own course in their colegio (RQ-PR13). */
  async crearMiCurso(input: {
    nombre: string;
    grado: string;
  }): Promise<{ ok: boolean; colegioId: string; cursoId: string; code: string }> {
    return { ok: true, ...(await api.post<{ colegioId: string; cursoId: string; code: string }>('/api/cursos', input)) };
  },

  /**
   * IA de authoring docente (RQ-CN06): the backend RETURNS a draft world
   * (teoría/preguntas/elige-camino) — it never writes content. The professor
   * reviews it in the wizard and saves it as their course's custom content.
   */
  async generarBorradorMundo(input: {
    colegioId: string;
    cursoId: string;
    nombre: string;
    tema: string;
    grado: string;
  }): Promise<import('./courseContentSchemas').MundoBorrador> {
    return api.post('/api/ia/borrador-mundo', input);
  },

  /**
   * IA de authoring docente, por ítem (RQ-CN06): the backend RETURNS a single
   * draft item of `tipo`, grounded in the world + its teoría + the pieces already
   * written (so it doesn't repeat) + an optional focus. The professor reviews it
   * in the editor before saving — nothing is persisted server-side.
   */
  async generarItemContenido(input: {
    colegioId: string;
    cursoId: string;
    tipo: import('./courseContentSchemas').BorradorItemTipo;
    nombre: string;
    descripcion: string;
    grado: string;
    esPrimera: boolean;
    detalle?: string;
    teoria?: string[];
    previas?: string[];
  }): Promise<import('./courseContentSchemas').BorradorItem> {
    return api.post('/api/ia/item-contenido', input);
  },
};
