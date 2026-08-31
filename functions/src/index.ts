/**
 * Ceti B2B2C — custom-claims provisioning & Ley 1581 lifecycle (Cloud Functions).
 *
 * Authorization in firestore.rules is driven by custom claims (role, colegioId,
 * cursoId). These functions are the ONLY trusted writer of those claims, of the
 * `membership/{uid}` mirror, and of the `estudiantes/{uid}` roster (clients never
 * write the roster — D-B1-03). Students are keyed by their Auth `uid` (R1): there
 * is no pseudonym key. Admin is granted by a Ceti-staff email allowlist
 * (`CETI_ADMIN_EMAILS`, D-ADMIN); professors by admin pre-authorization of their
 * email (`profesoresAutorizados/*`) o auto-registro docente. `resolveMyAccess`
 * settles claims on login.
 * See R1/R2/R3.
 *
 * Token note: after claims change, the client must call getIdToken(true) to
 * refresh; this writes a `claimsUpdatedAt` field the client can watch.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldPath, FieldValue } from 'firebase-admin/firestore';
import { groqCaller, ModelApiError } from './modelProvider';
import {
  classifyFinancialAssistantError,
  dailyFinancialAssistantUsagePath,
  FinancialAssistantQuotaError,
  isFinancialAssistantQuotaExceeded,
  planFinancialActionsWithQuota,
} from './financialAssistant';
import { parseProfessorAssignment } from './assignRolePolicy';
import {
  generarBorrador,
  generarItem,
  ITEM_TIPOS,
  DETALLE_MAX,
  CONTEXTO_ITEMS_MAX,
  NOMBRE_MAX,
  TEMA_MAX,
  type ItemTipo,
} from './mundoBorrador';

initializeApp();

// Tres roles (D-PIVOT): en la app solo profesor+estudiante; admin es claim de
// backend para aprovisionamiento. Rector y coordinador eliminados.
const ROLES = ['admin', 'profesor', 'estudiante'] as const;
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

// Grados válidos para un curso: 1° a 11°. (El contenido default sembrado solo
// cubre 9–11; los grados menores reutilizan el banco de 9° hasta que el profesor
// autore contenido propio — ver QuestionBankRepository.)
const GRADOS_VALIDOS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'] as const;

function isGradoValido(grado: string): boolean {
  return (GRADOS_VALIDOS as readonly string[]).includes(grado);
}

type Caller = NonNullable<Parameters<Parameters<typeof onCall>[0]>[0]['auth']>;

function requireAuth(caller: Caller | undefined): asserts caller is Caller {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');
}

function isAdmin(caller: Caller): boolean {
  return caller.token.role === 'admin';
}

// D-ADMIN: Ceti-staff admin allowlist. These emails receive role:admin on login
// (resolveMyAccess). The root admin is baked in; extend via the CETI_ADMIN_EMAILS
// env var (comma-separated) at deploy time. This is the ONLY way to become admin.
const CETI_ADMIN_EMAILS = new Set(
  ['juandiegodiazave@gmail.com', ...(process.env.CETI_ADMIN_EMAILS ?? '').split(',')]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

function isAllowlistedAdminEmail(email: string | undefined): boolean {
  return !!email && CETI_ADMIN_EMAILS.has(email.toLowerCase());
}

/** Doc-id key for a professor authorization (email, normalized). */
function emailKey(email: string): string {
  return email.trim().toLowerCase();
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
 * Caller must be authorized for an operational action on `cursoId` (D-PIVOT).
 * admin (backend) → always. profesor → own colegio + own course.
 */
async function assertStaffOfCurso(
  caller: Caller,
  colegioId: string,
  cursoId: string
): Promise<void> {
  if (isAdmin(caller)) return;
  if (caller.token.colegioId !== colegioId) {
    throw new HttpsError('permission-denied', 'Outside your colegio.');
  }
  if (caller.token.role === 'profesor') {
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
 * Admin assigns a professor to a colegio. Identifies the target by email
 * (must have signed in once) or uid. Admin remains allowlist-only; students
 * self-join by code.
 */
export const assignRole = onCall(async (request) => {
  const caller = request.auth;
  requireAuth(caller);
  if (!isAdmin(caller)) {
    throw new HttpsError('permission-denied', 'Solo un admin puede asignar roles.');
  }

  let assignment;
  try {
    assignment = parseProfessorAssignment(request.data);
  } catch {
    throw new HttpsError(
      'invalid-argument',
      "Solo se puede asignar el rol 'profesor' con colegioId y sin cursoId."
    );
  }

  const emailArg = typeof request.data?.email === 'string' ? request.data.email.trim() : '';
  const uidArg = typeof request.data?.uid === 'string' ? request.data.uid.trim() : '';
  if (!emailArg && !uidArg) {
    throw new HttpsError('invalid-argument', "Provide 'email' or 'uid'.");
  }
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

  await applyClaims(targetUid, assignment);

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

  const db = getFirestore();
  const snap = await db.collection('colegios').get();
  const colegios = snap.docs.map((d) => {
    const data = d.data() ?? {};
    return {
      id: d.id,
      nombre: (data.nombre as string) ?? d.id,
      plan: (data.plan as string) ?? null,
      planMaxEstudiantes: (data.planMaxEstudiantes as number) ?? null,
    };
  });
  return { colegios };
});

/** Admin creates a course (RQ-AD04). grado ∈ 1..11; born with a join code. */
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
  if (!isGradoValido(grado)) {
    throw new HttpsError('invalid-argument', "'grado' must be '1'..'11'.");
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
    codigo: code,
    createdAt: FieldValue.serverTimestamp(),
    createdByUid: caller.uid,
  });

  return { ok: true, colegioId, cursoId, code };
});

// ---------------------------------------------------------------------------
// D-ADMIN — access resolution & professor authorization.
// ---------------------------------------------------------------------------

/**
 * Resolves a signed-in user's access on login (D-ADMIN). Idempotent, refresh-
 * safe. Order: (1) already has a role → return it; (2) Ceti admin allowlist →
 * grant admin; (3) pre-authorized professor email → grant profesor + colegio,
 * mark the authorization consumed; (4) a professor self-registers into a new,
 * isolated colegio; (5) otherwise → prospective student (no claims set — they
 * must join a class by code). Demo tokens already carry a role so they
 * short-circuit at (1).
 */
export const resolveMyAccess = onCall(async (request) => {
  const caller = request.auth;
  requireAuth(caller);

  if (isRole(caller.token.role)) {
    return {
      role: caller.token.role,
      colegioId: (caller.token.colegioId as string | undefined) ?? null,
      cursoId: (caller.token.cursoId as string | undefined) ?? null,
    };
  }

  const email = (caller.token.email as string | undefined)?.toLowerCase();

  // (2) Ceti staff admin.
  if (isAllowlistedAdminEmail(email)) {
    await applyClaims(caller.uid, { role: 'admin' });
    return { role: 'admin', colegioId: null, cursoId: null };
  }

  // (3) Pre-authorized professor.
  if (email) {
    const db = getFirestore();
    const ref = db.doc(`profesoresAutorizados/${emailKey(email)}`);
    const snap = await ref.get();
    if (snap.exists) {
      const colegioId = (snap.data()?.colegioId as string | undefined) ?? '';
      if (colegioId) {
        await applyClaims(caller.uid, { role: 'profesor', colegioId });
        await ref.set(
          { consumidoPorUid: caller.uid, consumidoAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        return { role: 'profesor', colegioId, cursoId: null };
      }
    }
  }

  // (4) Any authenticated adult can choose the teacher path. Creating a fresh
  // tenant prevents a self-registered teacher from entering another colegio.
  if (request.data?.requestedRole === 'profesor') {
    const db = getFirestore();
    const colegioRef = db.collection('colegios').doc();
    await colegioRef.set({
      nombre: 'Mi colegio',
      sedesEnabled: false,
      createdAt: FieldValue.serverTimestamp(),
      createdByUid: caller.uid,
    });
    await applyClaims(caller.uid, { role: 'profesor', colegioId: colegioRef.id });
    return { role: 'profesor', colegioId: colegioRef.id, cursoId: null };
  }

  // (5) Prospective student — no claims; the client shows the join-by-code gate.
  return { role: null, colegioId: null, cursoId: null };
});

/**
 * Admin pre-authorizes a professor's email into a colegio (RQ-AD08). Stored in
 * `profesoresAutorizados/{emailKey}`. If the email already has an account, the
 * claim is granted immediately; otherwise it resolves on their first login.
 */
export const authorizeProfesor = onCall(async (request) => {
  const caller = request.auth;
  requireAuth(caller);
  if (!isAdmin(caller)) {
    throw new HttpsError('permission-denied', 'Solo un admin autoriza profesores.');
  }
  const email = requireString(request.data?.email, 'email').toLowerCase();
  const colegioId = requireString(request.data?.colegioId, 'colegioId');

  const db = getFirestore();
  if (!(await db.doc(`colegios/${colegioId}`).get()).exists) {
    throw new HttpsError('not-found', `El colegio '${colegioId}' no existe.`);
  }
  const ref = db.doc(`profesoresAutorizados/${emailKey(email)}`);
  await ref.set(
    {
      email,
      colegioId,
      autorizadoPor: caller.uid,
      autorizadoAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // If the account already exists, grant the claim now (unless already admin).
  try {
    const user = await getAuth().getUserByEmail(email);
    if ((user.customClaims?.role as string | undefined) !== 'admin') {
      await applyClaims(user.uid, { role: 'profesor', colegioId });
      await ref.set(
        { consumidoPorUid: user.uid, consumidoAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
  } catch {
    // No account yet — the authorization resolves on their first login.
  }

  return { ok: true, email, colegioId };
});

/**
 * Admin revokes a professor authorization (RQ-AD08). Removes the authorization
 * and, if the professor had already been granted, revokes their claims (they can
 * no longer operate). Their cursos and students' data are NOT deleted here —
 * suppression of student data is a separate, explicit action (RQ-FN11).
 */
export const revokeProfesorAuthorization = onCall(async (request) => {
  const caller = request.auth;
  requireAuth(caller);
  if (!isAdmin(caller)) {
    throw new HttpsError('permission-denied', 'Solo un admin revoca profesores.');
  }
  const email = requireString(request.data?.email, 'email').toLowerCase();

  const db = getFirestore();
  const ref = db.doc(`profesoresAutorizados/${emailKey(email)}`);
  const consumidoPorUid = (await ref.get()).data()?.consumidoPorUid as string | undefined;
  await ref.delete();
  if (consumidoPorUid) {
    await getAuth().setCustomUserClaims(consumidoPorUid, {});
    await db
      .doc(`membership/${consumidoPorUid}`)
      .delete()
      .catch(() => undefined);
  }
  return { ok: true };
});

/**
 * A professor creates their OWN course in their colegio (RQ-PR13, D-ADMIN).
 * Mints a unique join code atomically (2 professors never share a code). The
 * professor is the sole teacher on it; they then configure it (D-ORQ) and invite
 * students by code/link.
 */
export const crearMiCurso = onCall(async (request) => {
  const caller = request.auth;
  requireAuth(caller);
  if (caller.token.role !== 'profesor') {
    throw new HttpsError('permission-denied', 'Solo un profesor crea sus clases.');
  }
  const colegioId = caller.token.colegioId as string | undefined;
  if (!colegioId) {
    throw new HttpsError('failed-precondition', 'Tu cuenta no tiene un colegio asignado.');
  }
  const nombre = requireString(request.data?.nombre, 'nombre');
  const grado = requireString(request.data?.grado, 'grado');
  if (!isGradoValido(grado)) {
    throw new HttpsError('invalid-argument', "'grado' must be '1'..'11'.");
  }

  const db = getFirestore();
  const cursoRef = db.collection(`colegios/${colegioId}/cursos`).doc();
  const code = await mintUniqueCode(db);
  await db.doc(`classCodes/${code}`).set({
    colegioId,
    cursoId: cursoRef.id,
    createdAt: FieldValue.serverTimestamp(),
  });
  await cursoRef.set({
    nombre,
    grado,
    profesorUids: [caller.uid],
    codigo: code,
    createdAt: FieldValue.serverTimestamp(),
    createdByUid: caller.uid,
  });
  return { ok: true, colegioId, cursoId: cursoRef.id, code };
});

// ---------------------------------------------------------------------------
// Ley 1581 — lightweight attestation & data suppression (no acudiente PII).
// ---------------------------------------------------------------------------

/**
 * Record (or revoke) the lightweight acudiente attestation for a student and gate
 * activation accordingly. NO acudiente PII is stored — only the boolean + who/when
 * + policy version (RQ-FN10). atestado:true → estudiante activo; false → pendiente.
 * Allowed: admin (backend), profesor of the course.
 */
export const atestar = onCall(async (request) => {
  const caller = request.auth;
  requireAuth(caller);

  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  const cursoId = requireString(request.data?.cursoId, 'cursoId');
  const uid = requireString(request.data?.uid, 'uid');
  const atestado = request.data?.atestado === true;
  const politicaVersion = requireString(request.data?.politicaVersion, 'politicaVersion');

  await assertStaffOfCurso(caller, colegioId, cursoId);

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
 * Allowed: admin (backend) + profesor of the course (D-PIVOT).
 */
export const suppressStudentData = onCall(async (request) => {
  const caller = request.auth;
  requireAuth(caller);

  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  const cursoId = requireString(request.data?.cursoId, 'cursoId');
  const uid = requireString(request.data?.uid, 'uid');

  await assertStaffOfCurso(caller, colegioId, cursoId);

  const db = getFirestore();
  const estRef = db.doc(`colegios/${colegioId}/cursos/${cursoId}/estudiantes/${uid}`);

  // Delete all per-world progress + impact tests (the minor's generated data).
  await db.recursiveDelete(estRef.collection('progress'));
  await db.recursiveDelete(estRef.collection('impactTest'));
  // Reto signals (RQ-PR14 CA9) — derived from the diary, live under the student.
  await db.recursiveDelete(estRef.collection('retos'));
  // Account-scoped data under users/{uid}: the pocket-money diary (RQ-ES10 CA7),
  // the budgets config (RQ-ES11 CA10), and the simulated savings goals/deposits
  // that the prior suppression left behind (goals/deposits also derive the diary
  // bridge D-ES10-04, so a complete Ley 1581 erasure must include them).
  const userRef = db.doc(`users/${uid}`);
  await db.recursiveDelete(userRef.collection('movimientos'));
  await db.recursiveDelete(userRef.collection('config'));
  await db.recursiveDelete(userRef.collection('goals'));
  await db.recursiveDelete(userRef.collection('deposits'));

  // Los contadores viven en una colección raíz con id `${uid}_AAAA-MM-DD`.
  // Se pagina y se filtra el formato exacto para no borrar el UID `ana_2` al
  // suprimir `ana`, y cada commit queda bajo el límite de 500 escrituras.
  const usagePrefix = `${uid}_`;
  const escapedUid = uid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exactUsageId = new RegExp(`^${escapedUid}_\\d{4}-\\d{2}-\\d{2}$`);
  const usageCollection = db.collection('financialAssistantUsage');
  let lastUsageDoc;
  do {
    let usageQuery = usageCollection
      .orderBy(FieldPath.documentId())
      .startAt(usagePrefix)
      .endAt(`${usagePrefix}\uf8ff`);
    if (lastUsageDoc) usageQuery = usageQuery.startAfter(lastUsageDoc);
    const usageSnapshot = await usageQuery.limit(400).get();
    if (usageSnapshot.size === 0) break;

    const usageBatch = db.batch();
    const ownedUsageDocs = usageSnapshot.docs.filter((doc) => exactUsageId.test(doc.id));
    ownedUsageDocs.forEach((doc) => usageBatch.delete(doc.ref));
    if (ownedUsageDocs.length > 0) await usageBatch.commit();
    lastUsageDoc = usageSnapshot.docs.at(-1);
    if (usageSnapshot.size < 400) break;
  } while (lastUsageDoc);

  await estRef.set(
    {
      estado: 'suprimido',
      atestado: false,
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
 * Staff (re)generates the join code for a course (admin backend / profesor of
 * the course, matriz §1.3). Regenerating invalidates the previous code.
 */
export const generateClassCode = onCall(async (request) => {
  const caller = request.auth;
  requireAuth(caller);
  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  const cursoId = requireString(request.data?.cursoId, 'cursoId');
  await assertStaffOfCurso(caller, colegioId, cursoId);

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
  // Un profesor/admin no se une como estudiante: joinByCode sobreescribe claims,
  // así que sin este guard un link de invitación degradaría su rol. La UI ya no
  // los expone al gate, pero la callable debe defenderse por sí misma.
  if (caller.token.role === 'profesor' || caller.token.role === 'admin') {
    throw new HttpsError(
      'failed-precondition',
      'Un profesor o administrador no puede unirse a una clase como estudiante.'
    );
  }
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

const GROQ_API_KEY = defineSecret('GROQ_API_KEY');
function financialAssistantUsageRef(uid: string) {
  return getFirestore().doc(dailyFinancialAssistantUsagePath(uid));
}

export const planificarAccionesFinancieras = onCall(
  { secrets: [GROQ_API_KEY] },
  async (request) => {
    requireAuth(request.auth);
    if (request.auth.token.role !== 'estudiante') {
      throw new HttpsError('permission-denied', 'Solo estudiantes usan el asistente financiero.');
    }
    const usageRef = financialAssistantUsageRef(request.auth.uid);
    try {
      return await planFinancialActionsWithQuota(
        request.data,
        groqCaller(GROQ_API_KEY.value(), { maxTokens: 1200, timeoutMs: 20_000 }),
        async () => {
          await getFirestore().runTransaction(async (transaction) => {
            const usage =
              ((await transaction.get(usageRef)).data()?.count as number | undefined) ?? 0;
            if (isFinancialAssistantQuotaExceeded(usage)) {
              throw new FinancialAssistantQuotaError();
            }
            transaction.set(
              usageRef,
              { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
              { merge: true }
            );
          });
          // El intento consume cupo aunque Groq falle: limita coste y abuso concurrente.
        }
      );
    } catch (error) {
      const mapped = classifyFinancialAssistantError(error);
      if ('logCode' in mapped) {
        console.error('planificarAccionesFinancieras: fallo', { code: mapped.logCode });
      }
      throw new HttpsError(mapped.code, mapped.message);
    }
  }
);
// ---------------------------------------------------------------------------
// IA de authoring docente (RQ-CN06, D-ORQ). Server-side ONLY: genera un
// BORRADOR de mundo (teoría + preguntas + elige-camino) que se RETORNA al
// profesor — nunca escribe contenido; el profesor revisa y guarda desde la UI
// bajo las rules de cursos/{cursoId}/contenido/*. El prompt recibe solo
// nombre/tema/grado — jamás datos de estudiantes (CA2). No toca el runtime
// del estudiante (R7 intacto para esa capa).
// ---------------------------------------------------------------------------

const IA_AUTHORING_CAP_DIARIO = 20;

/** Counter doc for the daily authoring cap (CA3), keyed by uid + UTC day. */
function iaAuthoringUsoRef(uid: string) {
  const day = new Date().toISOString().slice(0, 10);
  return getFirestore().doc(`iaAuthoringUso/${uid}_${day}`);
}

export const generarBorradorMundo = onCall({ secrets: [GROQ_API_KEY] }, async (request) => {
  const caller = request.auth;
  requireAuth(caller);
  if (caller.token.role !== 'profesor') {
    throw new HttpsError('permission-denied', 'Solo profesores generan borradores.');
  }
  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  const cursoId = requireString(request.data?.cursoId, 'cursoId');
  const nombre = requireString(request.data?.nombre, 'nombre');
  const tema = requireString(request.data?.tema, 'tema');
  const grado = requireString(request.data?.grado, 'grado');
  if (nombre.length > NOMBRE_MAX || tema.length > TEMA_MAX || !isGradoValido(grado)) {
    throw new HttpsError('invalid-argument', 'Parámetros fuera de rango.');
  }
  await assertStaffOfCurso(caller, colegioId, cursoId);

  // Cap diario (mismo criterio que la voz: solo el éxito consume cuota).
  const usoSnap = await iaAuthoringUsoRef(caller.uid).get();
  const count = (usoSnap.data()?.count as number | undefined) ?? 0;
  if (count >= IA_AUTHORING_CAP_DIARIO) {
    throw new HttpsError('resource-exhausted', 'Límite diario de generación con IA alcanzado.');
  }

  let borrador;
  try {
    borrador = await generarBorrador(
      { nombre, tema, grado },
      groqCaller(GROQ_API_KEY.value(), { maxTokens: 4000, timeoutMs: 45_000 })
    );
  } catch (e) {
    console.error('generarBorradorMundo: fallo de generación', e);
    if (e instanceof ModelApiError) {
      throw new HttpsError('unavailable', 'El generador no está disponible, intenta de nuevo.');
    }
    throw new HttpsError('internal', 'No se pudo generar el borrador.');
  }

  await iaAuthoringUsoRef(caller.uid).set(
    { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return borrador;
});

// Single-item generation from the editor (RQ-CN06). Its own daily budget, more
// generous than the full-world one: authoring granularly is many small calls,
// so 20/day would run out fast; each call is small and cheap.
const IA_ITEM_CAP_DIARIO = 120;

function iaItemUsoRef(uid: string) {
  const day = new Date().toISOString().slice(0, 10);
  return getFirestore().doc(`iaItemUso/${uid}_${day}`);
}

/** Sanitizes an optional string array of context lines (no PII — CA2). */
function stringArray(value: unknown, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === 'string' ? v.trim().slice(0, maxLen) : ''))
    .filter((v) => v.length > 0)
    .slice(0, CONTEXTO_ITEMS_MAX);
}

export const generarItemContenido = onCall({ secrets: [GROQ_API_KEY] }, async (request) => {
  const caller = request.auth;
  requireAuth(caller);
  if (caller.token.role !== 'profesor') {
    throw new HttpsError('permission-denied', 'Solo profesores generan contenido.');
  }
  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  const cursoId = requireString(request.data?.cursoId, 'cursoId');
  const tipo = requireString(request.data?.tipo, 'tipo');
  const nombre = requireString(request.data?.nombre, 'nombre');
  const descripcion = requireString(request.data?.descripcion, 'descripcion');
  const grado = requireString(request.data?.grado, 'grado');
  if (
    !(ITEM_TIPOS as readonly string[]).includes(tipo) ||
    nombre.length > NOMBRE_MAX ||
    descripcion.length > TEMA_MAX ||
    !isGradoValido(grado)
  ) {
    throw new HttpsError('invalid-argument', 'Parámetros fuera de rango.');
  }
  const detalleRaw = request.data?.detalle;
  const detalle =
    typeof detalleRaw === 'string' && detalleRaw.trim().length > 0
      ? detalleRaw.trim().slice(0, DETALLE_MAX)
      : undefined;
  await assertStaffOfCurso(caller, colegioId, cursoId);

  const usoSnap = await iaItemUsoRef(caller.uid).get();
  const count = (usoSnap.data()?.count as number | undefined) ?? 0;
  if (count >= IA_ITEM_CAP_DIARIO) {
    throw new HttpsError('resource-exhausted', 'Límite diario de generación alcanzado.');
  }

  let item;
  try {
    item = await generarItem(
      {
        tipo: tipo as ItemTipo,
        nombre,
        descripcion,
        grado,
        esPrimera: request.data?.esPrimera === true,
        detalle,
        teoria: stringArray(request.data?.teoria, 800),
        previas: stringArray(request.data?.previas, 400),
      },
      groqCaller(GROQ_API_KEY.value(), { maxTokens: 900, timeoutMs: 30_000 })
    );
  } catch (e) {
    console.error('generarItemContenido: fallo de generación', e);
    if (e instanceof ModelApiError) {
      throw new HttpsError('unavailable', 'El generador no está disponible, intenta de nuevo.');
    }
    throw new HttpsError('internal', 'No se pudo generar el contenido.');
  }

  await iaItemUsoRef(caller.uid).set(
    { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return item;
});

// ---------------------------------------------------------------------------
// Per-course aggregates (RQ-FN09). The profesor reads these non-nominal
// aggregates for reporting (matriz §1.3, D-PIVOT). Nothing in the client or
// firestore.rules can write them: rules say `write: if false` for agregados/*,
// so the ONLY trusted writer is this trigger via the Admin SDK (bypasses rules).
//
// A Firestore onWrite trigger over every student's per-world progress doc keeps
// the aggregate fresh automatically (no client call needed). On each progress
// change we recompute the AFFECTED course's aggregate FROM SCRATCH by reading
// all of its progress — recompute-from-truth, so it is idempotent and self-heals
// (a missed/duplicated event still converges to the correct value).
//
// Privacy invariant (R4/R5/RQ-FN09): the aggregate stores ZERO nominal data — no
// names, no emails, no per-student uids. Only counts and per-competency / per-world
// averages. `estudiantesActivos` is a COUNT of distinct uids, never the uids.
// ---------------------------------------------------------------------------

/** Single rolled-up aggregate doc id under a course's agregados/ collection. */
const AGREGADO_RESUMEN_ID = 'resumen';

type CompetenciaAgregado = {
  /** mastery promedio 0..1 across distinct students with data on this competencia. */
  masteryPromedio: number;
  /** # distinct students with at least one progress doc on this competencia. */
  estudiantes: number;
  /** # distinct students who completed at least one world of this competencia. */
  completados: number;
};

type ResumenAgregado = {
  colegioId: string;
  cursoId: string;
  /** Per-CONPES-competency roll-up (keyed by competencia id). */
  porCompetencia: Record<string, CompetenciaAgregado>;
  /** Per-world roll-up (keyed by worldId = progress doc id). */
  porMundo: Record<string, { masteryPromedio: number; estudiantes: number; completados: number }>;
  /** # distinct students with any progress in the course. */
  estudiantesActivos: number;
  /** Course-wide mastery promedio across all progress docs (0..1). */
  masteryPromedio: number;
  /** % of (estudiantesActivos × 5 worlds) progress slots marked completed, 0..1. */
  porcentajeCompletado: number;
  actualizadoAt: FieldValue;
};

const WORLDS_POR_CURSO = 5; // 5 worlds = 5 CONPES competencies (see competencias.ts).

function promedio(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Recompute the aggregate doc for one course from ALL its progress docs. Reads
 * the tenant subtree via a collection-group query scoped to the course, then
 * writes `agregados/resumen` with ONLY aggregate metrics (no nominal data).
 */
async function recomputeCursoAgregado(colegioId: string, cursoId: string): Promise<void> {
  const db = getFirestore();
  // Scope a collection-group read to this one course (denormalized keys on each
  // progress doc, written under the rules' guard).
  const snap = await db
    .collectionGroup('progress')
    .where('colegioId', '==', colegioId)
    .where('cursoId', '==', cursoId)
    .get();

  const porCompetencia: Record<
    string,
    { masteries: number[]; uids: Set<string>; done: Set<string> }
  > = {};
  const porMundo: Record<string, { masteries: number[]; uids: Set<string>; done: Set<string> }> =
    {};
  const allMasteries: number[] = [];
  const activeUids = new Set<string>();
  let completedSlots = 0;

  for (const d of snap.docs) {
    const p = d.data() as {
      uid?: string;
      competencia?: string;
      mastery?: number;
      completed?: boolean;
    };
    const uid = typeof p.uid === 'string' ? p.uid : d.id;
    const mastery = typeof p.mastery === 'number' ? p.mastery : 0;
    const completed = p.completed === true;
    const worldId = d.id;
    const comp = typeof p.competencia === 'string' ? p.competencia : 'desconocida';

    activeUids.add(uid);
    allMasteries.push(mastery);
    if (completed) completedSlots += 1;

    const c = (porCompetencia[comp] ??= { masteries: [], uids: new Set(), done: new Set() });
    c.masteries.push(mastery);
    c.uids.add(uid);
    if (completed) c.done.add(uid);

    const m = (porMundo[worldId] ??= { masteries: [], uids: new Set(), done: new Set() });
    m.masteries.push(mastery);
    m.uids.add(uid);
    if (completed) m.done.add(uid);
  }

  const agregadoRef = db.doc(
    `colegios/${colegioId}/cursos/${cursoId}/agregados/${AGREGADO_RESUMEN_ID}`
  );

  // No progress left (e.g. last student suppressed/reset): delete the stale doc
  // so the profesor never sees a frozen aggregate.
  if (snap.empty) {
    await agregadoRef.delete().catch(() => undefined);
    return;
  }

  const resumen: ResumenAgregado = {
    colegioId,
    cursoId,
    porCompetencia: Object.fromEntries(
      Object.entries(porCompetencia).map(([k, v]) => [
        k,
        {
          masteryPromedio: promedio(v.masteries),
          estudiantes: v.uids.size,
          completados: v.done.size,
        },
      ])
    ),
    porMundo: Object.fromEntries(
      Object.entries(porMundo).map(([k, v]) => [
        k,
        {
          masteryPromedio: promedio(v.masteries),
          estudiantes: v.uids.size,
          completados: v.done.size,
        },
      ])
    ),
    estudiantesActivos: activeUids.size,
    masteryPromedio: promedio(allMasteries),
    porcentajeCompletado:
      activeUids.size === 0 ? 0 : completedSlots / (activeUids.size * WORLDS_POR_CURSO),
    actualizadoAt: FieldValue.serverTimestamp(),
  };

  // Full overwrite (not merge): recompute-from-truth replaces the prior snapshot.
  await agregadoRef.set(resumen);
}

/**
 * Trigger: any change to a student's per-world progress recomputes the affected
 * course's aggregate. Writes via Admin SDK (bypasses rules).
 */
export const onProgressWriteAggregate = onDocumentWritten(
  'colegios/{cid}/cursos/{cursoId}/estudiantes/{uid}/progress/{worldId}',
  async (event) => {
    const { cid, cursoId } = event.params;
    await recomputeCursoAgregado(cid, cursoId);
  }
);
