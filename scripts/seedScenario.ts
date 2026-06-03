/**
 * One-off demo scenario: a colegio + curso with a super-admin, a rector and a
 * student across three real Google accounts. Idempotent.
 *
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
 *   $env:GOOGLE_CLOUD_PROJECT = "ceti-d3769"
 *   npx ts-node --project tsconfig.scripts.json scripts/seedScenario.ts
 *
 * Accounts that haven't signed in are pre-created in Auth; when they later sign
 * in with Google, Firebase links by email (one-account-per-email) so the claims
 * apply. If linking is off in your project, have them sign in and re-run, or
 * re-assign by email from the admin panels.
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

const SUPERADMIN = 'juandiegodiazave@gmail.com';
const RECTOR = 'juandiegodiazave12@gmail.com';
const STUDENT = 'danielportacio09@gmail.com';

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
  const existing = (await auth.getUser(uid)).customClaims ?? {};
  await auth.setCustomUserClaims(uid, { ...existing, ...claims });
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

  // Super-admin (also keeps whatever role they already had)
  const superUid = await ensureUser(SUPERADMIN);
  await setClaims(superUid, { superadmin: true });

  // Rector of ceti-piloto
  const rectorUid = await ensureUser(RECTOR);
  await setClaims(rectorUid, { role: 'rector', colegioId: COLEGIO });

  // Student in 10A (active, Ley 1581 authorization recorded for the demo)
  const studentUid = await ensureUser(STUDENT);
  const studentId = 'stu_daniel';
  await db
    .doc(`colegios/${COLEGIO}/cursos/${CURSO}/estudiantes/${studentId}`)
    .set(
      {
        displayLabel: 'Daniel Portacio',
        estado: 'activo',
        uidVinculado: studentUid,
        createdAt: NOW,
      },
      { merge: true }
    );
  await db
    .doc(`colegios/${COLEGIO}/autorizaciones/${studentId}`)
    .set(
      {
        estado: 'otorgada',
        politicaVersion: 'v1',
        otorgadaAt: NOW,
        canalEvidencia: 'seed-escenario',
      },
      { merge: true }
    );
  await setClaims(studentUid, {
    role: 'estudiante',
    colegioId: COLEGIO,
    cursoId: CURSO,
    studentId,
  });

  console.log(`✅ Escenario listo en "${COLEGIO}" / "${CURSO}":`);
  console.log(`   super-admin: ${SUPERADMIN}`);
  console.log(`   rector:      ${RECTOR}`);
  console.log(`   estudiante:  ${STUDENT} (${studentId}, activo)`);
  console.log('   Cada cuenta debe (re)iniciar sesión para aplicar su rol.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌', e.message ?? e);
    process.exit(1);
  });
