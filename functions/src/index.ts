/**
 * Ceti B2B2C — custom-claims provisioning (Cloud Functions, Blaze).
 *
 * Authorization in firestore.rules is driven by custom claims (role, colegioId,
 * sedeId, studentId). These functions are the ONLY trusted writer of those
 * claims and of the matching `membership/{uid}` doc. See docs/data-model.md.
 *
 * Token note: after claims change, the client must call getIdToken(true) to
 * refresh; this writes a `claimsUpdatedAt` field the client can watch.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();

const ROLES = ['rector', 'coordinador', 'profesor', 'estudiante'] as const;
type Role = (typeof ROLES)[number];

function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpsError('invalid-argument', `Missing or invalid '${field}'.`);
  }
  return value.trim();
}

/** Super-admins allowed to bootstrap a colegio (comma-separated emails). */
function superAdminEmails(): string[] {
  return (process.env.CETI_SUPERADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

type ClaimsPayload = {
  role: Role;
  colegioId: string;
  sedeId?: string;
  studentId?: string;
  cursoId?: string;
};

/** Sets auth custom claims + mirrors them into membership/{uid}. */
async function applyClaims(uid: string, payload: ClaimsPayload): Promise<void> {
  const claims: Record<string, unknown> = {
    role: payload.role,
    colegioId: payload.colegioId,
  };
  if (payload.sedeId) claims.sedeId = payload.sedeId;
  if (payload.role === 'estudiante') {
    if (!payload.studentId) {
      throw new HttpsError('invalid-argument', "Role 'estudiante' requires a studentId.");
    }
    if (!payload.cursoId) {
      throw new HttpsError('invalid-argument', "Role 'estudiante' requires a cursoId.");
    }
    claims.studentId = payload.studentId;
    claims.cursoId = payload.cursoId;
  }

  await getAuth().setCustomUserClaims(uid, claims);

  await getFirestore()
    .doc(`membership/${uid}`)
    .set(
      {
        role: payload.role,
        colegioId: payload.colegioId,
        ...(payload.sedeId ? { sedeId: payload.sedeId } : {}),
        ...(payload.studentId ? { studentId: payload.studentId } : {}),
        ...(payload.cursoId ? { cursoId: payload.cursoId } : {}),
        claimsUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

/**
 * Assign a role to a user within the caller's own colegio.
 * - rector: may assign any role.
 * - coordinador: may assign only 'profesor' or 'estudiante'.
 * Caller must belong (by claims) to the same colegio as the target.
 */
export const setMemberClaims = onCall(async (request) => {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');

  const callerRole = caller.token.role;
  const callerColegio = caller.token.colegioId;
  if (callerRole !== 'rector' && callerRole !== 'coordinador') {
    throw new HttpsError('permission-denied', 'Only rector/coordinador can assign roles.');
  }

  const targetUid = requireString(request.data?.uid, 'uid');
  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  const role = request.data?.role;
  if (!isRole(role)) {
    throw new HttpsError('invalid-argument', `'role' must be one of: ${ROLES.join(', ')}.`);
  }
  if (colegioId !== callerColegio) {
    throw new HttpsError('permission-denied', 'Cannot assign roles outside your colegio.');
  }
  if (callerRole === 'coordinador' && (role === 'rector' || role === 'coordinador')) {
    throw new HttpsError('permission-denied', 'Coordinador cannot assign rector/coordinador.');
  }

  const sedeId = request.data?.sedeId ? requireString(request.data.sedeId, 'sedeId') : undefined;
  const studentId = request.data?.studentId
    ? requireString(request.data.studentId, 'studentId')
    : undefined;
  const cursoId = request.data?.cursoId
    ? requireString(request.data.cursoId, 'cursoId')
    : undefined;

  await applyClaims(targetUid, { role, colegioId, sedeId, studentId, cursoId });
  return { ok: true };
});

/**
 * One-time bootstrap: create a colegio and make the caller its first rector.
 * Guarded by a super-admin email allowlist (env CETI_SUPERADMIN_EMAILS) with a
 * verified email — resolves the chicken-and-egg of the first claim.
 */
export const bootstrapColegio = onCall(async (request) => {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');

  const email = (caller.token.email ?? '').toLowerCase();
  const emailVerified = caller.token.email_verified === true;
  if (!email || !emailVerified || !superAdminEmails().includes(email)) {
    throw new HttpsError('permission-denied', 'Not authorized to bootstrap a colegio.');
  }

  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  const nombre = requireString(request.data?.nombre, 'nombre');

  const colegioRef = getFirestore().doc(`colegios/${colegioId}`);
  const existing = await colegioRef.get();
  if (existing.exists) {
    throw new HttpsError('already-exists', `Colegio '${colegioId}' already exists.`);
  }

  await colegioRef.set({
    nombre,
    sedesEnabled: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  await applyClaims(caller.uid, { role: 'rector', colegioId });
  return { ok: true, colegioId };
});

// ---------------------------------------------------------------------------
// Ley 1581 — acudiente authorization & data suppression (see docs/COMPLIANCE.md).
// ---------------------------------------------------------------------------

type Caller = NonNullable<Parameters<Parameters<typeof onCall>[0]>[0]['auth']>;

/** Verify the caller is a teacher listed on the course. */
async function assertProfesorDeCurso(
  uid: string,
  colegioId: string,
  cursoId: string
): Promise<void> {
  const snap = await getFirestore().doc(`colegios/${colegioId}/cursos/${cursoId}`).get();
  const profesorUids = (snap.data()?.profesorUids ?? []) as string[];
  if (!snap.exists || !profesorUids.includes(uid)) {
    throw new HttpsError('permission-denied', 'Not a teacher of this course.');
  }
}

/** Caller must be staff of `colegioId`; teachers must also own the course. */
async function assertStaffOfColegio(
  caller: Caller,
  colegioId: string,
  cursoId: string,
  opts: { allowProfesor: boolean }
): Promise<void> {
  if (caller.token.colegioId !== colegioId) {
    throw new HttpsError('permission-denied', 'Outside your colegio.');
  }
  const r = caller.token.role;
  if (r === 'rector' || r === 'coordinador') return;
  if (opts.allowProfesor && r === 'profesor') {
    await assertProfesorDeCurso(caller.uid, colegioId, cursoId);
    return;
  }
  throw new HttpsError('permission-denied', 'Insufficient role.');
}

/**
 * Record (or revoke) the acudiente's data-treatment authorization for a student
 * and gate activation accordingly. Consent is collected out-of-band (signed
 * form / verified channel) and recorded here by staff with evidence metadata.
 * 'otorgada' → estudiante activo; 'revocada' → back to pendiente (deactivated).
 */
export const setAuthorizationStatus = onCall(async (request) => {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');

  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  const cursoId = requireString(request.data?.cursoId, 'cursoId');
  const studentId = requireString(request.data?.studentId, 'studentId');
  const estado = request.data?.estado;
  if (estado !== 'otorgada' && estado !== 'revocada') {
    throw new HttpsError('invalid-argument', "'estado' must be 'otorgada' or 'revocada'.");
  }
  const politicaVersion = requireString(request.data?.politicaVersion, 'politicaVersion');
  const canalEvidencia =
    typeof request.data?.canalEvidencia === 'string' ? request.data.canalEvidencia : undefined;
  const acudienteRef =
    typeof request.data?.acudienteRef === 'string' ? request.data.acudienteRef : undefined;

  await assertStaffOfColegio(caller, colegioId, cursoId, { allowProfesor: true });

  const db = getFirestore();
  const autRef = db.doc(`colegios/${colegioId}/autorizaciones/${studentId}`);
  const estRef = db.doc(`colegios/${colegioId}/cursos/${cursoId}/estudiantes/${studentId}`);

  const batch = db.batch();
  batch.set(
    autRef,
    {
      estado,
      politicaVersion,
      ...(canalEvidencia ? { canalEvidencia } : {}),
      ...(acudienteRef ? { acudienteRef } : {}),
      ...(estado === 'otorgada' ? { otorgadaAt: FieldValue.serverTimestamp() } : {}),
      registradaPor: caller.uid,
      registradaAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  batch.set(
    estRef,
    { estado: estado === 'otorgada' ? 'activo' : 'pendiente_autorizacion' },
    { merge: true }
  );
  await batch.commit();

  return { ok: true, estado };
});

/**
 * Ley 1581 right to suppression: deletes the student's progress data, marks the
 * roster slot 'suprimido', unlinks the auth account, and revokes consent.
 * Restricted to rector/coordinador (sensitive, irreversible).
 */
export const suppressStudentData = onCall(async (request) => {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');

  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  const cursoId = requireString(request.data?.cursoId, 'cursoId');
  const studentId = requireString(request.data?.studentId, 'studentId');

  await assertStaffOfColegio(caller, colegioId, cursoId, { allowProfesor: false });

  const db = getFirestore();
  const estRef = db.doc(`colegios/${colegioId}/cursos/${cursoId}/estudiantes/${studentId}`);

  // Delete all per-world progress (the minor's generated data).
  await db.recursiveDelete(estRef.collection('progress'));

  const batch = db.batch();
  batch.set(
    estRef,
    {
      estado: 'suprimido',
      uidVinculado: FieldValue.delete(),
      suprimidoAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  batch.set(
    db.doc(`colegios/${colegioId}/autorizaciones/${studentId}`),
    { estado: 'revocada', suprimidoAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  await batch.commit();

  return { ok: true };
});
