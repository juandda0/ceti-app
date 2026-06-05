/**
 * One-off demo scenario: a colegio + curso with an admin, a rector and a student
 * across three real Google accounts. Idempotent. Identity is by Auth uid (R1);
 * only email + nombre are stored for the student (R4). Lightweight attestation is
 * pre-set for the demo (no acudiente PII).
 *
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
 *   $env:GOOGLE_CLOUD_PROJECT = "ceti-d3769"
 *   npx ts-node --project tsconfig.scripts.json scripts/seedScenario.ts
 *
 * Accounts that haven't signed in are pre-created in Auth; when they later sign
 * in with Google, Firebase links by email (one-account-per-email) so the claims
 * apply.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

if (!admin.apps.length) {
  const saPath = path.resolve(__dirname, '../serviceAccount.json');
  try {
    admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
  } catch {
    admin.initializeApp();
  }
}

const auth = admin.auth();
const db = admin.firestore();
const NOW = Date.now();
const COLEGIO = 'ceti-piloto';
const COLEGIO_NOMBRE = 'Colegio Piloto Ceti';
const CURSO = '10A';

const ADMIN = 'juandiegodiazave@gmail.com';
const RECTOR = 'juandiegodiazave12@gmail.com';
const STUDENT = 'danielportacio09@gmail.com';
const STUDENT_NOMBRE = 'Daniel Portacio';

/** Returns the uid for an email, creating the auth user if it doesn't exist. */
async function ensureUser(email: string): Promise<string> {
  try {
    return (await auth.getUserByEmail(email)).uid;
  } catch {
    const created = await auth.createUser({ email, emailVerified: true });
    console.log(`  · pre-creada cuenta Auth para ${email}`);
    return created.uid;
  }
}

async function setClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
  await auth.setCustomUserClaims(uid, claims);
  await db.doc(`membership/${uid}`).set({ ...claims, claimsUpdatedAt: NOW }, { merge: true });
}

async function main(): Promise<void> {
  // Colegio + curso
  await db
    .doc(`colegios/${COLEGIO}`)
    .set({ nombre: COLEGIO_NOMBRE, sedesEnabled: false, createdAt: NOW }, { merge: true });
  await db
    .doc(`colegios/${COLEGIO}/cursos/${CURSO}`)
    .set(
      { nombre: CURSO, grado: '10', profesorUids: [], colaboracionAula: false },
      { merge: true }
    );

  // Global admin Ceti
  const adminUid = await ensureUser(ADMIN);
  await setClaims(adminUid, { role: 'admin' });

  // Rector of ceti-piloto
  const rectorUid = await ensureUser(RECTOR);
  await setClaims(rectorUid, { role: 'rector', colegioId: COLEGIO });

  // Student in 10A — keyed by uid, only email + nombre, active (demo attestation).
  const studentUid = await ensureUser(STUDENT);
  await db.doc(`colegios/${COLEGIO}/cursos/${CURSO}/estudiantes/${studentUid}`).set(
    {
      email: STUDENT,
      nombre: STUDENT_NOMBRE,
      estado: 'activo',
      atestado: true,
      atestadoPor: rectorUid,
      atestadoAt: NOW,
      politicaVersion: 'v1',
      joinedAt: NOW,
    },
    { merge: true }
  );
  await setClaims(studentUid, { role: 'estudiante', colegioId: COLEGIO, cursoId: CURSO });

  console.log(`✅ Escenario listo en "${COLEGIO}" / "${CURSO}":`);
  console.log(`   admin Ceti:  ${ADMIN}`);
  console.log(`   rector:      ${RECTOR}`);
  console.log(`   estudiante:  ${STUDENT} (${studentUid}, activo)`);
  console.log('   Cada cuenta debe (re)iniciar sesión para aplicar su rol.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌', e.message ?? e);
    process.exit(1);
  });
