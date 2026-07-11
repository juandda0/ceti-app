/**
 * Course operations for the profesor (D-PIVOT). Claim/auth/PII-sensitive actions
 * go through Cloud Functions (the only trusted writer of claims, roster and
 * structure — R2/R3/D-B1-03). Structural provisioning (create colegio/curso,
 * assign teachers) is Admin SDK only (backend) and has NO client entry point here.
 */
import { callFunction } from '@shared/lib/firebase/functions';

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
};
