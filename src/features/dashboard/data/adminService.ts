/**
 * Admin/provisioning operations for the in-app console. Claim/auth-sensitive
 * actions go through Cloud Functions; plain tenant writes (cursos, roster) go
 * straight to Firestore (firestore.rules authorizes staff).
 */
import { addDoc, setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { cursosCollectionRef, estudianteDocRef } from '@shared/lib/firebase/paths';
import { stripUndefinedValues } from '@shared/lib/firebase/sanitizeForFirestore';
import { callFunction } from '@shared/lib/firebase/functions';
import type { Role } from '@shared/types/tenancy';

export const adminService = {
  /** Rector/coordinador creates a course (Firestore; rules gate to staff). */
  async createCurso(colegioId: string, data: { nombre: string; grado: string }): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    await addDoc(cursosCollectionRef(clients.firestore, colegioId), {
      nombre: data.nombre,
      grado: data.grado,
      profesorUids: [],
      colaboracionAula: false,
    });
    return true;
  },

  /** Adds a roster slot (pseudonym). Starts pendiente_autorizacion (Ley 1581). */
  async addEstudiante(
    colegioId: string,
    cursoId: string,
    data: { studentId: string; displayLabel: string }
  ): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    await setDoc(
      estudianteDocRef(clients.firestore, colegioId, cursoId, data.studentId),
      stripUndefinedValues({
        displayLabel: data.displayLabel,
        estado: 'pendiente_autorizacion',
        createdAt: Date.now(),
      }),
      { merge: true }
    );
    return true;
  },

  /** Assigns a role to a user (by email) — Cloud Function (sets custom claims). */
  async assignMember(input: {
    email: string;
    role: Role;
    colegioId: string;
    cursoId?: string;
    studentId?: string;
  }): Promise<{ ok: boolean; uid?: string }> {
    return callFunction('setMemberClaims', input);
  },

  /** Records (or revokes) the acudiente authorization — Cloud Function (Ley 1581). */
  async setAuthorization(input: {
    colegioId: string;
    cursoId: string;
    studentId: string;
    estado: 'otorgada' | 'revocada';
    politicaVersion: string;
    canalEvidencia?: string;
  }): Promise<{ ok: boolean }> {
    return callFunction('setAuthorizationStatus', input);
  },

  /** Creates a colegio and makes the caller its first rector — Cloud Function. */
  async createColegio(colegioId: string, nombre: string): Promise<{ ok: boolean }> {
    return callFunction('bootstrapColegio', { colegioId, nombre });
  },

  /** Generates (or returns) the join code for a course — Cloud Function. */
  async generateClassCode(colegioId: string, cursoId: string): Promise<{ code: string }> {
    return callFunction('generateClassCode', { colegioId, cursoId });
  },

  /** Student self-joins a course by code — Cloud Function. */
  async joinByCode(code: string): Promise<{ ok: boolean; colegioId: string; cursoId: string }> {
    return callFunction('joinByCode', { code });
  },
};
