/**
 * Ceti B2B2C — custom-claims provisioning & Ley 1581 lifecycle (Cloud Functions).
 *
 * Authorization in firestore.rules is driven by custom claims (role, colegioId,
 * cursoId). These functions are the ONLY trusted writer of those claims, of the
 * `membership/{uid}` mirror, and of the `estudiantes/{uid}` roster (clients never
 * write the roster — D-B1-03). Students are keyed by their Auth `uid` (R1): there
 * is no pseudonym key. There is no email allowlist; the FIRST admin is provisioned
 * out-of-band via the Admin SDK seed script (scripts/setRole.ts). See R1/R2/R3.
 *
 * Token note: after claims change, the client must call getIdToken(true) to
 * refresh; this writes a `claimsUpdatedAt` field the client can watch.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();

const ROLES = ['admin', 'rector', 'coordinador', 'profesor', 'estudiante'] as const;
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

type Caller = NonNullable<Parameters<Parameters<typeof onCall>[0]>[0]['auth']>;

function requireAuth(caller: Caller | undefined): asserts caller is Caller {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');
}

function isAdmin(caller: Caller): boolean {
  return caller.token.role === 'admin';
}

type ClaimsPayload = {
  role: Role;
  colegioId?: string;
  cursoId?: string;
};

/** Sets auth custom claims + mirrors them into membership/{uid}. Sole writer (R2). */
async function applyClaims(uid: string, payload: ClaimsPayload): Promise<void> {
  let claims: Record<string, unknown>;
  if (payload.role === 'admin') {
    // admin is global — no colegioId/cursoId (R3).
    claims = { role: 'admin' };
  } else {
    if (!payload.colegioId) {
      throw new HttpsError('invalid-argument', `Role '${payload.role}' requires a colegioId.`);
    }
    if (payload.role === 'estudiante' && !payload.cursoId) {
      throw new HttpsError('invalid-argument', "Role 'estudiante' requires a cursoId.");
    }
    claims = { role: payload.role, colegioId: payload.colegioId };
    if (payload.cursoId) claims.cursoId = payload.cursoId;
  }

  await getAuth().setCustomUserClaims(uid, claims);
  await getFirestore()
    .doc(`membership/${uid}`)
    .set({ ...claims, claimsUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

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

/**
 * Caller must be authorized staff for an operational action on `cursoId`.
 * admin → always. coordinador → own colegio. rector → own colegio if allowRector.
 * profesor → own colegio + own course if allowProfesor.
 */
async function assertStaffOfCurso(
  caller: Caller,
  colegioId: string,
  cursoId: string,
  opts: { allowProfesor: boolean; allowRector: boolean }
): Promise<void> {
  if (isAdmin(caller)) return;
  if (caller.token.colegioId !== colegioId) {
    throw new HttpsError('permission-denied', 'Outside your colegio.');
  }
  const r = caller.token.role;
  if (r === 'coordinador') return;
  if (r === 'rector' && opts.allowRector) return;
  if (r === 'profesor' && opts.allowProfesor) {
    await assertProfesorDeCurso(caller.uid, colegioId, cursoId);
    return;
  }
  throw new HttpsError('permission-denied', 'Insufficient role for this action.');
}

// ---------------------------------------------------------------------------
// Role assignment (admin-only — D7/RQ-FN06). No adult self-assigns; students are
// assigned only via joinByCode.
// ---------------------------------------------------------------------------

/**
 * Admin creates/updates an adult's role within a colegio. Identifies the target
 * by email (must have signed in once) or uid. Cannot assign 'estudiante'
 * (students self-join by code).
 */
export const assignRole = onCall(async (request) => {
  const caller = request.auth;
  requireAuth(caller);
  if (!isAdmin(caller)) {
    throw new HttpsError('permission-denied', 'Solo un admin puede asignar roles.');
  }

  const role = request.data?.role;
  if (!isRole(role)) {
    throw new HttpsError('invalid-argument', `'role' must be one of: ${ROLES.join(', ')}.`);
  }
  if (role === 'estudiante') {
    throw new HttpsError('invalid-argument', 'Los estudiantes se unen por código, no por rol.');
  }

  const emailArg = typeof request.data?.email === 'string' ? request.data.email.trim() : '';
  const uidArg = typeof request.data?.uid === 'string' ? request.data.uid.trim() : '';
  if (!emailArg && !uidArg) {
    throw new HttpsError('invalid-argument', "Provide 'email' or 'uid'.");
  }
  const colegioId =
    role === 'admin' ? undefined : requireString(request.data?.colegioId, 'colegioId');
  const cursoId =
    typeof request.data?.cursoId === 'string' ? request.data.cursoId.trim() : undefined;

  let targetUid = uidArg;
  if (!targetUid) {
    try {
      targetUid = (await getAuth().getUserByEmail(emailArg)).uid;
    } catch {
      throw new HttpsError(
        'not-found',
        `No existe un usuario con el correo ${emailArg}. Debe iniciar sesión al menos una vez.`
      );
    }
  }

  await applyClaims(targetUid, { role, colegioId, cursoId });

  // Wire a teacher into the course roster of teachers.
  if (role === 'profesor' && colegioId && cursoId) {
    await getFirestore()
      .doc(`colegios/${colegioId}/cursos/${cursoId}`)
      .set({ profesorUids: FieldValue.arrayUnion(targetUid) }, { merge: true });
  }

  return { ok: true, uid: targetUid };
});

// ---------------------------------------------------------------------------
// Colegio / curso provisioning (admin-only — matriz §1.3 "Estructura").
// ---------------------------------------------------------------------------

/** Admin creates a colegio (RQ-AD02). Always born with sedesEnabled:false. */
export const registerColegio = onCall(async (request) => {
  const caller = request.auth;
  requireAuth(caller);
  if (!isAdmin(caller)) {
    throw new HttpsError('permission-denied', 'Solo un admin puede registrar colegios.');
  }

  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  const nombre = requireString(request.data?.nombre, 'nombre');
  const plan = typeof request.data?.plan === 'string' ? request.data.plan : undefined;
  const planMaxEstudiantes =
    typeof request.data?.planMaxEstudiantes === 'number'
      ? request.data.planMaxEstudiantes
      : undefined;

  const colegioRef = getFirestore().doc(`colegios/${colegioId}`);
  if ((await colegioRef.get()).exists) {
    throw new HttpsError('already-exists', `El colegio '${colegioId}' ya existe.`);
  }

  await colegioRef.set({
    nombre,
    sedesEnabled: false,
    ...(plan ? { plan } : {}),
    ...(planMaxEstudiantes !== undefined ? { planMaxEstudiantes } : {}),
    createdAt: FieldValue.serverTimestamp(),
    createdByUid: caller.uid,
  });

  return { ok: true, colegioId };
});

/** Lists all colegios (admin overview — RQ-AD01). */
export const listColegios = onCall(async (request) => {
  const caller = request.auth;
  requireAuth(caller);
  if (!isAdmin(caller)) {
    throw new HttpsError('permission-denied', 'Solo un admin puede listar colegios.');
  }

  const snap = await getFirestore().collection('colegios').get();
  const colegios = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      nombre: (data.nombre as string) ?? d.id,
      plan: (data.plan as string) ?? null,
      planMaxEstudiantes: (data.planMaxEstudiantes as number) ?? null,
    };
  });
  return { colegios };
});

/** Admin creates a course (RQ-AD04). grado ∈ {9,10,11}; born with a join code. */
export const createCurso = onCall(async (request) => {
  const caller = request.auth;
  requireAuth(caller);
  if (!isAdmin(caller)) {
    throw new HttpsError('permission-denied', 'Solo un admin puede crear cursos.');
  }

  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  const cursoId = requireString(request.data?.cursoId, 'cursoId');
  const nombre = requireString(request.data?.nombre, 'nombre');
  const grado = requireString(request.data?.grado, 'grado');
  if (grado !== '9' && grado !== '10' && grado !== '11') {
    throw new HttpsError('invalid-argument', "'grado' must be '9', '10' or '11'.");
  }

  const db = getFirestore();
  const cursoRef = db.doc(`colegios/${colegioId}/cursos/${cursoId}`);
  if ((await cursoRef.get()).exists) {
    throw new HttpsError('already-exists', `El curso '${cursoId}' ya existe.`);
  }
  const code = await mintUniqueCode(db);
  await db.doc(`classCodes/${code}`).set({
    colegioId,
    cursoId,
    createdAt: FieldValue.serverTimestamp(),
  });
  await cursoRef.set({
    nombre,
    grado,
    profesorUids: [],
    colaboracionAula: false,
    codigo: code,
    createdAt: FieldValue.serverTimestamp(),
    createdByUid: caller.uid,
  });

  return { ok: true, colegioId, cursoId, code };
});

// ---------------------------------------------------------------------------
// Ley 1581 — lightweight attestation & data suppression (no acudiente PII).
// ---------------------------------------------------------------------------

/**
 * Record (or revoke) the lightweight acudiente attestation for a student and gate
 * activation accordingly. NO acudiente PII is stored — only the boolean + who/when
 * + policy version (RQ-FN10). atestado:true → estudiante activo; false → pendiente.
 * Allowed: admin, rector, coordinador, profesor of the course.
 */
export const atestar = onCall(async (request) => {
  const caller = request.auth;
  requireAuth(caller);

  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  const cursoId = requireString(request.data?.cursoId, 'cursoId');
  const uid = requireString(request.data?.uid, 'uid');
  const atestado = request.data?.atestado === true;
  const politicaVersion = requireString(request.data?.politicaVersion, 'politicaVersion');

  await assertStaffOfCurso(caller, colegioId, cursoId, { allowProfesor: true, allowRector: true });

  const estRef = getFirestore().doc(`colegios/${colegioId}/cursos/${cursoId}/estudiantes/${uid}`);
  if (!(await estRef.get()).exists) {
    throw new HttpsError('not-found', 'El estudiante no existe en este curso.');
  }

  await estRef.set(
    {
      atestado,
      estado: atestado ? 'activo' : 'pendiente_atestacion',
      politicaVersion,
      atestadoPor: caller.uid,
      atestadoAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true, atestado };
});

/**
 * Ley 1581 right to suppression: deletes the student's progress + impact data,
 * marks the roster slot 'suprimido', unlinks the auth claims. Irreversible.
 * Restricted to admin / rector / coordinador (NOT profesor).
 */
export const suppressStudentData = onCall(async (request) => {
  const caller = request.auth;
  requireAuth(caller);

  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  const cursoId = requireString(request.data?.cursoId, 'cursoId');
  const uid = requireString(request.data?.uid, 'uid');

  await assertStaffOfCurso(caller, colegioId, cursoId, { allowProfesor: false, allowRector: true });

  const db = getFirestore();
  const estRef = db.doc(`colegios/${colegioId}/cursos/${cursoId}/estudiantes/${uid}`);

  // Delete all per-world progress + impact tests (the minor's generated data).
  await db.recursiveDelete(estRef.collection('progress'));
  await db.recursiveDelete(estRef.collection('impactTest'));

  await estRef.set(
    {
      estado: 'suprimido',
      atestado: false,
      suprimidoAt: FieldValue.serverTimestamp(),
      suprimidoPor: caller.uid,
    },
    { merge: true }
  );

  // Revoke the student's claims so they lose game access.
  try {
    await getAuth().setCustomUserClaims(uid, {});
    await db.doc(`membership/${uid}`).delete();
  } catch {
    // Auth user may already be gone; suppression of data still stands.
  }

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

async function mintUniqueCode(db: FirebaseFirestore.Firestore): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = randomCode();
    if (!(await db.doc(`classCodes/${candidate}`).get()).exists) return candidate;
  }
  throw new HttpsError('internal', 'No se pudo generar un código único.');
}

/**
 * Staff (re)generates the join code for a course (admin/coordinador/profesor —
 * NOT rector, matriz §1.3). Regenerating invalidates the previous code.
 */
export const generateClassCode = onCall(async (request) => {
  const caller = request.auth;
  requireAuth(caller);
  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  const cursoId = requireString(request.data?.cursoId, 'cursoId');
  await assertStaffOfCurso(caller, colegioId, cursoId, { allowProfesor: true, allowRector: false });

  const db = getFirestore();
  const cursoRef = db.doc(`colegios/${colegioId}/cursos/${cursoId}`);
  const regenerate = request.data?.regenerate === true;
  const existing = (await cursoRef.get()).data()?.codigo as string | undefined;
  if (existing && !regenerate) return { code: existing };

  const code = await mintUniqueCode(db);
  // Invalidate the old code so it can no longer be used to join.
  if (existing)
    await db
      .doc(`classCodes/${existing}`)
      .delete()
      .catch(() => undefined);
  await db.doc(`classCodes/${code}`).set({
    colegioId,
    cursoId,
    createdAt: FieldValue.serverTimestamp(),
  });
  await cursoRef.set({ codigo: code }, { merge: true });
  return { code };
});

/**
 * Student self-joins a course by code (RQ-FN05). Creates a roster slot keyed by
 * their Auth `uid` (R1), storing only email + nombre, in 'pendiente_atestacion'
 * (Ley 1581 gate: inactive until a staffer attests). Sets the student's claims.
 * Idempotent: re-joining the same course is a no-op.
 */
export const joinByCode = onCall(async (request) => {
  const caller = request.auth;
  requireAuth(caller);
  const code = requireString(request.data?.code, 'code').toUpperCase();

  const db = getFirestore();
  const codeSnap = await db.doc(`classCodes/${code}`).get();
  if (!codeSnap.exists) throw new HttpsError('not-found', 'Código de clase inválido.');
  const { colegioId, cursoId } = codeSnap.data() as { colegioId: string; cursoId: string };

  // Already linked to this exact course → no-op (idempotent).
  if (caller.token.colegioId === colegioId && caller.token.cursoId === cursoId) {
    return { ok: true, colegioId, cursoId };
  }

  const email = (caller.token.email as string | undefined) ?? '';
  const nombre = (caller.token.name as string | undefined) || email.split('@')[0] || 'Estudiante';

  const estRef = db.doc(`colegios/${colegioId}/cursos/${cursoId}/estudiantes/${caller.uid}`);
  const existing = await estRef.get();
  // Preserve an existing activation if the student was already attested.
  if (!existing.exists) {
    await estRef.set({
      email,
      nombre,
      estado: 'pendiente_atestacion',
      atestado: false,
      joinedAt: FieldValue.serverTimestamp(),
    });
  }
  await applyClaims(caller.uid, { role: 'estudiante', colegioId, cursoId });

  return { ok: true, colegioId, cursoId };
});
