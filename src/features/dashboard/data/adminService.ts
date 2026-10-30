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

  /** Student leaves their class and keeps using the app on their own. */
  async salirDeMiClase(): Promise<{ ok: boolean }> {
    return callFunction('salirDeMiClase', {});
  },

  /** Teacher removes a student from the class without deleting their progress. */
  async retirarEstudiante(input: {
    colegioId: string;
    cursoId: string;
    uid: string;
  }): Promise<{ ok: boolean; retirado: boolean }> {
    return callFunction('retirarEstudiante', input);
  },

  /** Rename, change the grade, archive, or turn the join code on/off. */
  async editarMiCurso(input: {
    colegioId: string;
    cursoId: string;
    cambios: { nombre?: string; grado?: string; archivada?: boolean; codigoActivo?: boolean };
  }): Promise<{ ok: boolean; codigo: string | null }> {
    return callFunction('editarMiCurso', input);
  },

  /** Deletes a class nobody is in anymore. */
  async borrarMiCurso(input: { colegioId: string; cursoId: string }): Promise<{ ok: boolean }> {
    return callFunction('borrarMiCurso', input);
  },

  /** Student self-joins a course by code — Cloud Function. */
  async joinByCode(
    code: string,
    nombre?: string
  ): Promise<{ ok: boolean; colegioId: string; cursoId: string }> {
    return callFunction('joinByCode', nombre ? { code, nombre } : { code });
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
    return callFunction('resolveMyAccess', requestedRole === 'profesor' ? { requestedRole } : {});
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
    return callFunction('listColegios');
  },

  /** Admin creates a colegio (D-ADMIN / RQ-AD02). */
  async registerColegio(input: { colegioId: string; nombre: string }): Promise<{ ok: boolean }> {
    return callFunction('registerColegio', input);
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
