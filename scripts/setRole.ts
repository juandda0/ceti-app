/**
 * Sets Ceti role/tenant custom claims for an existing auth user (by email).
 * The user must have signed into the app at least once (Google) so the auth
 * account exists. Run with ADC or a service account:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
 *   $env:GOOGLE_CLOUD_PROJECT = "ceti-d3769"
 *   npx ts-node --project tsconfig.scripts.json scripts/setRole.ts <email> <role> <colegioId> [cursoId] [studentId]
 *
 * Example (make yourself rector of the demo colegio):
 *   ... scripts/setRole.ts juandiegodiazave@gmail.com rector demo
 *
 * After running, the user must refresh their token (getIdToken(true)) — sign out
 * and back in works too.
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

const ROLES = ['rector', 'coordinador', 'profesor', 'estudiante'];

async function main(): Promise<void> {
  const [, , email, role, colegioId, cursoId, studentId] = process.argv;
  if (!email || !role || !colegioId) {
    throw new Error('Uso: setRole.ts <email> <role> <colegioId> [cursoId] [studentId]');
  }
  if (!ROLES.includes(role)) throw new Error(`role debe ser uno de: ${ROLES.join(', ')}`);
  if (role === 'estudiante' && (!cursoId || !studentId)) {
    throw new Error("role 'estudiante' requiere cursoId y studentId");
  }

  const user = await admin.auth().getUserByEmail(email);
  const claims: Record<string, string> = { role, colegioId };
  if (cursoId) claims.cursoId = cursoId;
  if (studentId) claims.studentId = studentId;

  await admin.auth().setCustomUserClaims(user.uid, claims);
  await admin
    .firestore()
    .doc(`membership/${user.uid}`)
    .set({ ...claims, claimsUpdatedAt: Date.now() }, { merge: true });

  console.log(
    `✅ ${email} (${user.uid}) -> ${JSON.stringify(claims)}. Refresca el token (re-login).`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌', e.message ?? e);
    process.exit(1);
  });
