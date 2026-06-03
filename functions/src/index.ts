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

/** Super-admins allowed to register/administer colegios (comma-separated emails). */
function superAdminEmails(): string[] {
  return (process.env.CETI_SUPERADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

type CallerLike = { token: { email?: unknown; email_verified?: unknown } };
/** True if the caller's verified email is in the super-admin allowlist. */
function isSuperAdmin(caller: CallerLike): boolean {
  const email = (typeof caller.token.email === 'string' ? caller.token.email : '').toLowerCase();
  return !!email && caller.token.email_verified === true && superAdminEmails().includes(email);
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

  const superAdmin = isSuperAdmin(caller);
  const callerRole = caller.token.role;
  const callerColegio = caller.token.colegioId;
  if (!superAdmin && callerRole !== 'rector' && callerRole !== 'coordinador') {
    throw new HttpsError('permission-denied', 'Only rector/coordinador can assign roles.');
  }

  // Target identified by email (admin console) or uid.
  const emailArg = typeof request.data?.email === 'string' ? request.data.email.trim() : '';
  const uidArg = typeof request.data?.uid === 'string' ? request.data.uid.trim() : '';
  if (!emailArg && !uidArg) {
    throw new HttpsError('invalid-argument', "Provide 'email' or 'uid'.");
  }
  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  const role = request.data?.role;
  if (!isRole(role)) {
    throw new HttpsError('invalid-argument', `'role' must be one of: ${ROLES.join(', ')}.`);
  }
  // Super-admins may assign any role in any colegio; staff only within their own.
  if (!superAdmin && colegioId !== callerColegio) {
    throw new HttpsError('permission-denied', 'Cannot assign roles outside your colegio.');
  }
  if (
    !superAdmin &&
    callerRole === 'coordinador' &&
    (role === 'rector' || role === 'coordinador')
  ) {
    throw new HttpsError('permission-denied', 'Coordinador cannot assign rector/coordinador.');
  }

  const sedeId = request.data?.sedeId ? requireString(request.data.sedeId, 'sedeId') : undefined;
  const studentId = request.data?.studentId
    ? requireString(request.data.studentId, 'studentId')
    : undefined;
  const cursoId = request.data?.cursoId
    ? requireString(request.data.cursoId, 'cursoId')
    : undefined;

  let targetUid = uidArg;
  if (!targetUid) {
    try {
      targetUid = (await getAuth().getUserByEmail(emailArg)).uid;
    } catch {
      throw new HttpsError(
        'not-found',
        `No existe un usuario con el correo ${emailArg}. Debe iniciar sesion al menos una vez.`
      );
    }
  }

  await applyClaims(targetUid, { role, colegioId, sedeId, studentId, cursoId });

  // Wire the membership both ways so the dashboards resolve.
  const db = getFirestore();
  if (role === 'profesor' && cursoId) {
    await db
      .doc(`colegios/${colegioId}/cursos/${cursoId}`)
      .set({ profesorUids: FieldValue.arrayUnion(targetUid) }, { merge: true });
  }
  if (role === 'estudiante' && cursoId && studentId) {
    await db
      .doc(`colegios/${colegioId}/cursos/${cursoId}/estudiantes/${studentId}`)
      .set({ uidVinculado: targetUid }, { merge: true });
  }

  return { ok: true, uid: targetUid };
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

// ---------------------------------------------------------------------------
// Class codes (Google-Classroom-style self-join). classCodes/{code} maps a code
// to a colegio/curso; only these functions (Admin) touch it (rules deny clients).
// ---------------------------------------------------------------------------

// No ambiguous chars (0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

/** Staff generates (or returns the existing) join code for a course. */
export const generateClassCode = onCall(async (request) => {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');
  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  const cursoId = requireString(request.data?.cursoId, 'cursoId');
  await assertStaffOfColegio(caller, colegioId, cursoId, { allowProfesor: true });

  const db = getFirestore();
  const cursoRef = db.doc(`colegios/${colegioId}/cursos/${cursoId}`);
  const existing = (await cursoRef.get()).data()?.codigo as string | undefined;
  if (existing) return { code: existing };

  let code = '';
  for (let attempt = 0; attempt < 10 && !code; attempt++) {
    const candidate = randomCode();
    if (!(await db.doc(`classCodes/${candidate}`).get()).exists) code = candidate;
  }
  if (!code) throw new HttpsError('internal', 'No se pudo generar un código único.');

  await db.doc(`classCodes/${code}`).set({
    colegioId,
    cursoId,
    createdAt: FieldValue.serverTimestamp(),
  });
  await cursoRef.set({ codigo: code }, { merge: true });
  return { code };
});

/**
 * Student self-joins a course by code. Creates a roster slot linked to their
 * auth account, in 'pendiente_autorizacion' (Ley 1581 gate: inactive until the
 * acudiente authorizes). Sets the student's claims.
 */
export const joinByCode = onCall(async (request) => {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');
  const code = requireString(request.data?.code, 'code').toUpperCase();

  const db = getFirestore();
  const codeSnap = await db.doc(`classCodes/${code}`).get();
  if (!codeSnap.exists) throw new HttpsError('not-found', 'Código de clase inválido.');
  const { colegioId, cursoId } = codeSnap.data() as { colegioId: string; cursoId: string };

  // Already linked to this colegio → no-op.
  if (caller.token.colegioId === colegioId && caller.token.studentId) {
    return { ok: true, colegioId, cursoId, studentId: caller.token.studentId };
  }

  const studentId = `stu_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  // Label so staff can identify the student; the school may rename to a pseudonym.
  const displayLabel =
    (caller.token.name as string | undefined) ||
    (caller.token.email as string | undefined)?.split('@')[0] ||
    'Estudiante';

  await db.doc(`colegios/${colegioId}/cursos/${cursoId}/estudiantes/${studentId}`).set({
    displayLabel,
    estado: 'pendiente_autorizacion',
    uidVinculado: caller.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  await applyClaims(caller.uid, { role: 'estudiante', colegioId, cursoId, studentId });

  return { ok: true, colegioId, cursoId, studentId };
});

// ---------------------------------------------------------------------------
// Platform super-admin: register & list colegios (above the rector level).
// Gated by the CETI_SUPERADMIN_EMAILS allowlist.
// ---------------------------------------------------------------------------

/** Creates a colegio and optionally assigns its first rector by email. */
export const registerColegio = onCall(async (request) => {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (!isSuperAdmin(caller)) {
    throw new HttpsError('permission-denied', 'Solo un super-admin puede registrar colegios.');
  }

  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  const nombre = requireString(request.data?.nombre, 'nombre');
  const plan = typeof request.data?.plan === 'string' ? request.data.plan : undefined;
  const rectorEmail =
    typeof request.data?.rectorEmail === 'string' ? request.data.rectorEmail.trim() : '';

  const colegioRef = getFirestore().doc(`colegios/${colegioId}`);
  if ((await colegioRef.get()).exists) {
    throw new HttpsError('already-exists', `El colegio '${colegioId}' ya existe.`);
  }

  await colegioRef.set({
    nombre,
    sedesEnabled: false,
    ...(plan ? { plan } : {}),
    createdAt: FieldValue.serverTimestamp(),
  });

  let rectorAssigned = false;
  if (rectorEmail) {
    try {
      const uid = (await getAuth().getUserByEmail(rectorEmail)).uid;
      await applyClaims(uid, { role: 'rector', colegioId });
      rectorAssigned = true;
    } catch {
      // Rector hasn't signed in yet; the colegio is created and a rector can be
      // assigned later from the super-admin panel once they have an account.
      rectorAssigned = false;
    }
  }

  return { ok: true, colegioId, rectorAssigned };
});

/** Lists all colegios (super-admin overview). */
export const listColegios = onCall(async (request) => {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (!isSuperAdmin(caller)) {
    throw new HttpsError('permission-denied', 'Solo un super-admin puede listar colegios.');
  }

  const snap = await getFirestore().collection('colegios').get();
  const colegios = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      nombre: (data.nombre as string) ?? d.id,
      plan: (data.plan as string) ?? null,
    };
  });
  return { colegios };
});
