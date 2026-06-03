/**
 * Grants (or revokes) the platform super-admin custom claim for a user by email.
 * The user's email should also be in functions' CETI_SUPERADMIN_EMAILS (the
 * Cloud Functions enforce that allowlist independently; this claim is the UI gate).
 * Merges with existing claims (won't wipe role/colegioId).
 *
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
 *   $env:GOOGLE_CLOUD_PROJECT = "ceti-d3769"
 *   npx ts-node --project tsconfig.scripts.json scripts/setSuperadmin.ts <email> [true|false]
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

async function main(): Promise<void> {
  const [, , email, flag] = process.argv;
  if (!email) throw new Error('Uso: setSuperadmin.ts <email> [true|false]');
  const value = flag !== 'false';

  const user = await admin.auth().getUserByEmail(email);
  const claims = { ...(user.customClaims ?? {}), superadmin: value };
  await admin.auth().setCustomUserClaims(user.uid, claims);

  console.log(
    `✅ ${email} superadmin=${value}. Claims: ${JSON.stringify(claims)}. Re-login para aplicar.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌', e.message ?? e);
    process.exit(1);
  });
