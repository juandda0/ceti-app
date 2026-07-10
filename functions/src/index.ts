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
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { clasificarTexto, groqCaller, ModelApiError } from './vozClasificacion';

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

type Caller = NonNullable<Parameters<Parameters<typeof onCall>[0]>[0]['auth']>;

function requireAuth(caller: Caller | undefined): asserts caller is Caller {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');
}

function isAdmin(caller: Caller): boolean {
  return caller.token.role === 'admin';
}

// ---- Demo cage (RQ-DM05) ----
const DEMO_COLEGIO = 'demo-colegio';
// D-PIVOT: solo profesor + estudiante en el demo. Se retira demo-admin porque
// demoLogin es un callable PÚBLICO y no debe acuñar un token admin (riesgo).
const DEMO_USERS: Record<string, { uid: string; claims: Record<string, unknown> }> = {
  profesor: {
    uid: 'demo-profesor',
    claims: { role: 'profesor', demo: true, colegioId: DEMO_COLEGIO },
  },
  estudiante: {
    uid: 'demo-estudiante',
    claims: { role: 'estudiante', demo: true, colegioId: DEMO_COLEGIO, cursoId: 'demo-9A' },
  },
};

function callerIsDemo(caller: Caller): boolean {
  return caller.token.demo === true;
}

/** A demo caller may never touch anything outside the demo colegio (RQ-DM05). */
function assertDemoScope(caller: Caller, colegioId: string | undefined): void {
  if (callerIsDemo(caller) && colegioId !== DEMO_COLEGIO) {
    throw new HttpsError('permission-denied', 'El modo demo solo opera dentro del colegio demo.');
  }
}

/** Structural/claim mutations are forbidden to demo callers (no real entities). */
function assertNotDemo(caller: Caller): void {
  if (callerIsDemo(caller)) {
    throw new HttpsError('permission-denied', 'El modo demo no puede ejecutar esta acción.');
  }
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
  assertDemoScope(caller, colegioId);
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
  assertNotDemo(caller); // a demo token can never assign real adult roles (RQ-DM05)

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
  assertNotDemo(caller); // demo admin cannot create real colegios (RQ-DM05)

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

  // Demo admin sees only the demo colegio (RQ-DM05).
  const db = getFirestore();
  const snap = callerIsDemo(caller)
    ? { docs: [await db.doc(`colegios/${DEMO_COLEGIO}`).get()].filter((d) => d.exists) }
    : await db.collection('colegios').get();
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

/** Admin creates a course (RQ-AD04). grado ∈ {9,10,11}; born with a join code. */
export const createCurso = onCall(async (request) => {
  const caller = request.auth;
  requireAuth(caller);
  if (!isAdmin(caller)) {
    throw new HttpsError('permission-denied', 'Solo un admin puede crear cursos.');
  }

  const colegioId = requireString(request.data?.colegioId, 'colegioId');
  assertDemoScope(caller, colegioId); // demo admin may only create within demo-colegio
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
  // Pocket-money diary (RQ-ES10 CA7) — account-scoped, so it lives under users/.
  await db.recursiveDelete(db.doc(`users/${uid}`).collection('movimientos'));

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
  const code = requireString(request.data?.code, 'code').toUpperCase();

  const db = getFirestore();
  const codeSnap = await db.doc(`classCodes/${code}`).get();
  if (!codeSnap.exists) throw new HttpsError('not-found', 'Código de clase inválido.');
  const { colegioId, cursoId } = codeSnap.data() as { colegioId: string; cursoId: string };
  assertDemoScope(caller, colegioId); // a demo student cannot join a real course (RQ-DM05)

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

// ---------------------------------------------------------------------------
// Voice diary classification (RQ-ES10). The ONLY runtime AI in Ceti — the
// narrow R7 exception (D-ES10-01). Receives the browser-transcribed TEXT of a
// student's pocket-money entry (audio never reaches our servers), classifies it
// via an LLM (Groq) with structured output, and RETURNS the classification. It never
// writes the movimiento — the client persists only after the student confirms
// (CA3), under the isSelf rules of users/{uid}/movimientos.
// ---------------------------------------------------------------------------

const GROQ_API_KEY = defineSecret('GROQ_API_KEY');
const VOZ_CAP_DIARIO = 30;
const VOZ_MAX_CHARS = 300;

/** Counter doc for the daily voice cap (CA8), keyed by uid + UTC day. */
function vozUsoRef(uid: string) {
  const day = new Date().toISOString().slice(0, 10);
  return getFirestore().doc(`vozUso/${uid}_${day}`);
}

/**
 * Read-only budget check (CA8): throws resource-exhausted at the cap WITHOUT
 * incrementing. The increment happens only after a successful classification
 * (`chargeVozBudget`), so model failures never consume the student's quota —
 * otherwise a provider outage would let a student burn all 30/day on retries
 * without a single successful registration and lock themselves out.
 * ponytail: read-then-charge is not atomic, but the cap is a soft cost guard and
 * the UI serializes requests (single `processing` flag) — per-account races are
 * benign. Tighten to a transaction only if concurrent abuse shows up.
 */
async function assertVozBudgetAvailable(uid: string): Promise<void> {
  const snap = await vozUsoRef(uid).get();
  const count = (snap.data()?.count as number | undefined) ?? 0;
  if (count >= VOZ_CAP_DIARIO) {
    throw new HttpsError('resource-exhausted', 'Límite diario de registros por voz alcanzado.');
  }
}

/** Charge one unit — called ONLY after a successful classification. */
async function chargeVozBudget(uid: string): Promise<void> {
  await vozUsoRef(uid).set(
    { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

export const procesarRegistroVoz = onCall({ secrets: [GROQ_API_KEY] }, async (request) => {
  const caller = request.auth;
  requireAuth(caller);
  if (caller.token.role !== 'estudiante') {
    throw new HttpsError('permission-denied', 'Solo estudiantes registran movimientos.');
  }
  const texto = requireString(request.data?.texto, 'texto');
  if (texto.length > VOZ_MAX_CHARS) {
    throw new HttpsError('invalid-argument', `'texto' supera ${VOZ_MAX_CHARS} caracteres.`);
  }

  await assertVozBudgetAvailable(caller.uid);

  let resultado;
  try {
    resultado = await clasificarTexto(texto, groqCaller(GROQ_API_KEY.value()));
  } catch (e) {
    // Log the REAL cause (bad key, model access, quota, bad request) — el
    // HttpsError que devolvemos es genérico, así que sin esto el error se pierde.
    console.error('procesarRegistroVoz: fallo de clasificación', e);
    if (e instanceof ModelApiError) {
      // HTTP/red/timeout del proveedor: reintentar. No se cobra cuota — el fallo
      // es del servidor/proveedor, no del estudiante.
      throw new HttpsError('unavailable', 'El clasificador no está disponible, intenta de nuevo.');
    }
    // JSON/forma inválida del modelo: bug nuestro o del modelo, no del usuario.
    throw new HttpsError('internal', 'No se pudo clasificar el registro.');
  }

  // Solo un éxito consume cuota (CA8).
  await chargeVozBudget(caller.uid);
  return resultado;
});

// ---------------------------------------------------------------------------
// Demo mode (RQ-DM). A PUBLIC (unauthenticated) callable that mints a custom
// token for ONE of the 2 fixed demo identities (profesor | estudiante — never
// admin, D-PIVOT). It cannot be parameterized into arbitrary claims — only the
// role selects a fixed (uid, claims) pair. All demo
// tokens carry demo:true, which firestore.rules + the Functions cage confine to
// `demo-colegio`. Signing in as the demo student first resets their progress so
// every demo starts fresh (RQ-DM06).
// ---------------------------------------------------------------------------
export const demoLogin = onCall(async (request) => {
  const role = typeof request.data?.role === 'string' ? request.data.role : '';
  const demo = DEMO_USERS[role];
  if (!demo) {
    throw new HttpsError(
      'invalid-argument',
      `role must be one of: ${Object.keys(DEMO_USERS).join(', ')}.`
    );
  }

  const auth = getAuth();
  const db = getFirestore();

  // Ensure the demo Auth user exists with its fixed demo claims (idempotent).
  try {
    await auth.getUser(demo.uid);
  } catch {
    await auth.createUser({ uid: demo.uid, displayName: `Demo ${role}` });
  }
  await auth.setCustomUserClaims(demo.uid, demo.claims);

  // Reset the demo student so every demo starts at zero (RQ-DM06). Aggregates
  // exclude the demo student by design, so this never corrupts them.
  if (role === 'estudiante') {
    const cursoId = demo.claims.cursoId as string;
    const estRef = db.doc(`colegios/${DEMO_COLEGIO}/cursos/${cursoId}/estudiantes/${demo.uid}`);
    await db.recursiveDelete(estRef.collection('progress'));
    await db.recursiveDelete(estRef.collection('impactTest'));
  }

  const token = await auth.createCustomToken(demo.uid, demo.claims);
  return { token, role };
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
 * course's aggregate. Writes via Admin SDK (bypasses rules). Demo colegio is
 * excluded by design — the demo student is reset on each demoLogin and must not
 * churn or pollute real aggregates (RQ-DM05/RQ-DM06).
 */
export const onProgressWriteAggregate = onDocumentWritten(
  'colegios/{cid}/cursos/{cursoId}/estudiantes/{uid}/progress/{worldId}',
  async (event) => {
    const { cid, cursoId } = event.params;
    if (cid === DEMO_COLEGIO) return;
    await recomputeCursoAgregado(cid, cursoId);
  }
);
