/**
 * Admin/provisioning operations for the in-app console. Claim/auth/PII-sensitive
 * actions go through Cloud Functions (the only trusted writer of claims, roster
 * and structure — R2/R3/D-B1-03). The only direct client write is toggling
 * colaboracionAula, which firestore.rules allows for coordinador/profesor.
 */
import { setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { cursoDocRef } from '@shared/lib/firebase/paths';
import { callFunction } from '@shared/lib/firebase/functions';
import type { Role } from '@shared/types/tenancy';

export const adminService = {
  /** Admin creates a course (Cloud Function — structure is admin-only, RQ-AD04). */
  async createCurso(input: {
    colegioId: string;
    cursoId: string;
    nombre: string;
    grado: '9' | '10' | '11';
  }): Promise<{ ok: boolean; code?: string }> {
    return callFunction('createCurso', input);
  },

  /** Admin assigns/changes an adult's role (Cloud Function — sets custom claims). */
  async assignRole(input: {
    email?: string;
    uid?: string;
    role: Exclude<Role, 'estudiante'>;
    colegioId?: string;
    cursoId?: string;
  }): Promise<{ ok: boolean; uid?: string }> {
    return callFunction('assignRole', input);
  },

  /** Teacher/staff toggles class collaboration (class leaderboard visibility). */
  async setColaboracion(colegioId: string, cursoId: string, enabled: boolean): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    await setDoc(
      cursoDocRef(clients.firestore, colegioId, cursoId),
      { colaboracionAula: enabled },
      { merge: true }
    );
    return true;
  },

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
   * progress/impact data, marks 'suprimido' and revokes claims. Restricted to
   * admin/rector/coordinador (irreversible).
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

  // ---- Platform admin Ceti (role:'admin' claim — R3) ----

  /** Admin registers a colegio (Cloud Function). Born with sedesEnabled:false. */
  async registerColegio(input: {
    colegioId: string;
    nombre: string;
    plan?: string;
    planMaxEstudiantes?: number;
  }): Promise<{ ok: boolean; colegioId: string }> {
    return callFunction('registerColegio', input);
  },

  /** Lists all colegios (admin overview). */
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
};
