/**
 * Purges the retired Demo/Simulation data from Firestore (D-NODEMO). One-shot,
 * idempotent: deletes the synthetic `demo-colegio` tree, its class join codes,
 * and the demo membership/users docs. Run by the project owner with ADC.
 *
 * This does NOT touch real tenants or the shared content banks.
 *
 * Run with ADC or a service account:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
 *   $env:GOOGLE_CLOUD_PROJECT = "ceti-d3769"
 *   npx ts-node --project tsconfig.scripts.json scripts/purgeDemo.ts
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
    admin.initializeApp(); // ADC (GOOGLE_APPLICATION_CREDENTIALS) + GOOGLE_CLOUD_PROJECT
  }
}

const db = admin.firestore();
const auth = admin.auth();

const DEMO_COLEGIO = 'demo-colegio';
const DEMO_UIDS = ['demo-profesor', 'demo-estudiante'];

async function main(): Promise<void> {
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '(desconocido)';
  console.log(`Purgando Modo Demo en el proyecto: ${project}`);

  // 1. The whole demo colegio tree (cursos, estudiantes, progress, agregados…).
  await db.recursiveDelete(db.doc(`colegios/${DEMO_COLEGIO}`));
  console.log(`  · borrado colegios/${DEMO_COLEGIO} (recursivo)`);

  // 2. Class join codes that pointed at the demo colegio.
  const codes = await db.collection('classCodes').where('colegioId', '==', DEMO_COLEGIO).get();
  for (const d of codes.docs) await d.ref.delete();
  console.log(`  · borrados ${codes.size} classCodes del demo`);

  // 3. Demo membership + users docs + their vozUso counters, and revoke claims.
  for (const uid of DEMO_UIDS) {
    await db.recursiveDelete(db.doc(`users/${uid}`));
    await db
      .doc(`membership/${uid}`)
      .delete()
      .catch(() => undefined);
    try {
      await auth.setCustomUserClaims(uid, {});
    } catch {
      /* the demo auth user may not exist — fine */
    }
    console.log(`  · limpiado ${uid} (users + membership + claims)`);
  }

  console.log('Listo. Modo Demo purgado.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
