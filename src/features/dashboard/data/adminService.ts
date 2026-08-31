/**
 * Course operations for the profesor (D-PIVOT). Claim/auth/PII-sensitive actions
 * go through Cloud Functions (the only trusted writer of claims, roster and
 * structure — R2/R3/D-B1-03). Structural provisioning (create colegio/curso,
 * assign teachers) is Admin SDK only (backend) and has NO client entry point here.
 */
import { callFunction } from '@shared/lib/firebase/functions';
import type { LoginIntent } from '@features/auth/data/loginIntent';

export const adminService = {
  /**
   * Lightweight Ley 1581 attestation (Cloud Function): the school confirms it
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
    return callFunction('atestar', input);
  },

  /**
   * Ley 1581 right to suppression (Cloud Function): deletes the student's
   * progress/impact data, marks 'suprimido' and revokes claims. Allowed to the
   * course's profesor + admin backend (irreversible).
   */
  async suppressStudent(input: {
    colegioId: string;
    cursoId: string;
    uid: string;
  }): Promise<{ ok: boolean }> {
    return callFunction('suppressStudentData', input);
  },

  /** (Re)generates the join code for a course — Cloud Function. */
  async generateClassCode(
    colegioId: string,
    cursoId: string,
    regenerate = false
  ): Promise<{ code: string }> {
    return callFunction('generateClassCode', { colegioId, cursoId, regenerate });
  },

  /** Student self-joins a course by code — Cloud Function. */
  async joinByCode(code: string): Promise<{ ok: boolean; colegioId: string; cursoId: string }> {
    return callFunction('joinByCode', { code });
  },

  /**
   * Resolves the signed-in user's access on login (D-ADMIN): grants admin
   * (allowlist), a pre-authorized professor, or a self-registered professor.
   * Otherwise returns null role (prospective student → join by code). Idempotent.
   */
  async resolveMyAccess(requestedRole: LoginIntent | null): Promise<{
    role: 'admin' | 'profesor' | 'estudiante' | null;
    colegioId: string | null;
    cursoId: string | null;
  }> {
    return callFunction('resolveMyAccess', requestedRole === 'profesor' ? { requestedRole } : {});
  },

  /** Admin lists all colegios (for the panel + authorize picker). */
  async listColegios(): Promise<{
    colegios: {
      id: string;
      nombre: string;
      plan: string | null;
      planMaxEstudiantes: number | null;
    }[];
  }> {
    return callFunction('listColegios');
  },

  /** Admin creates a colegio (D-ADMIN / RQ-AD02). */
  async registerColegio(input: { colegioId: string; nombre: string }): Promise<{ ok: boolean }> {
    return callFunction('registerColegio', input);
  },

  /** Admin pre-authorizes a professor email into a colegio (RQ-AD08). */
  async authorizeProfesor(input: {
    email: string;
    colegioId: string;
  }): Promise<{ ok: boolean; email: string; colegioId: string }> {
    return callFunction('authorizeProfesor', input);
  },

  /** Admin revokes a professor authorization (RQ-AD08). */
  async revokeProfesorAuthorization(email: string): Promise<{ ok: boolean }> {
    return callFunction('revokeProfesorAuthorization', { email });
  },

  /** Professor creates their own course in their colegio (RQ-PR13). */
  async crearMiCurso(input: {
    nombre: string;
    grado: string;
  }): Promise<{ ok: boolean; colegioId: string; cursoId: string; code: string }> {
    return callFunction('crearMiCurso', input);
  },

  /**
   * IA de authoring docente (RQ-CN06): the Function RETURNS a draft world
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
    return callFunction('generarBorradorMundo', input);
  },

  /**
   * IA de authoring docente, por ítem (RQ-CN06): the Function RETURNS a single
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
    return callFunction('generarItemContenido', input);
  },
};
