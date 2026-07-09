/**
 * Sets Ceti role/tenant custom claims for an existing auth user (by email), via
 * the Admin SDK. This is the out-of-band way the FIRST `admin` is provisioned
 * (there is no email allowlist anymore — R3). The user must have signed into the
 * app at least once (OAuth) so the auth account exists. Run with ADC or a service
 * account:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
 *   $env:GOOGLE_CLOUD_PROJECT = "ceti-d3769"
 *   npx ts-node --project tsconfig.scripts.json scripts/setRole.ts <email> <role> [colegioId] [cursoId]
 *
 * Examples:
 *   ... scripts/setRole.ts juandiegodiazave@gmail.com admin            # global admin (no colegio)
 *   ... scripts/setRole.ts profe@colegio.edu profesor demo c1          # profesor of "demo" course c1
 *
 * `admin` is global and carries no colegioId. `estudiante` is NOT settable here
 * (students join by code). After running, the user must refresh their token
 * (getIdToken(true)) — sign out and back in works too.
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

const ROLES = ['admin', 'profesor', 'estudiante'];

async function main(): Promise<void> {
  const [, , email, role, colegioId, cursoId] = process.argv;
  if (!email || !role) {
    throw new Error('Uso: setRole.ts <email> <role> [colegioId] [cursoId]');
  }
  if (!ROLES.includes(role)) throw new Error(`role debe ser uno de: ${ROLES.join(', ')}`);
  if (role === 'estudiante') {
    throw new Error("role 'estudiante' se asigna por joinByCode, no por este script");
  }
  if (role !== 'admin' && !colegioId) {
    throw new Error(`role '${role}' requiere colegioId`);
  }

  const user = await admin.auth().getUserByEmail(email);
  const claims: Record<string, string> = role === 'admin' ? { role } : { role, colegioId };
  if (role !== 'admin' && cursoId) claims.cursoId = cursoId;

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
