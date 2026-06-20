/**
 * Seeds the shared content banks (`bancos` collection, R8 / CN05) into Firestore
 * from the APPROVED content on disk. Read-only to clients; written only here via
 * the Admin SDK.
 *
 * Source of truth: content/approved/*.json — each is a manifest
 *   { bancoId, approvedFrom, gate } produced by E3 (scripts/bankGate.mjs).
 * Only QUIZ banks are seeded: bancoId matching `\d+_world_\d+_(multiple_choice|
 * true_false|ordenar)`. EligeCamino manifests (`\d+_world_\d+`, no tipo) are
 * skipped for now. The real content is loaded from content/bancos/<approvedFrom>
 * and written whole to `bancos/<bancoId>` (merge:true). Idempotent.
 *
 * Run with ADC or a service account:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
 *   $env:GOOGLE_CLOUD_PROJECT = "ceti-d3769"
 *   npx ts-node --project tsconfig.scripts.json scripts/seedBancos.ts
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
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

// GOTCHA: without GOOGLE_CLOUD_PROJECT (or a serviceAccount.json), the Admin SDK
// resolves the project from ADC's default — which may NOT be the intended
// Firebase project, silently seeding the wrong database. Surface the target so a
// wrong-project seed is obvious (and bail if none resolved).
const TARGET_PROJECT =
  admin.app().options.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
if (!TARGET_PROJECT) {
  console.error(
    '✗ No se pudo resolver el proyecto. Exporta GOOGLE_CLOUD_PROJECT=<tu-proyecto> (p.ej. ceti-d3769).'
  );
  process.exit(1);
}
console.log(`→ Sembrando bancos en el proyecto: ${TARGET_PROJECT}`);

const ROOT = path.resolve(__dirname, '..');
const APPROVED_DIR = path.join(ROOT, 'content', 'approved');
const BANKS_DIR = path.join(ROOT, 'content', 'bancos');

// Quiz banks only (R8/R9): grado_world_N_<tipo>. EligeCamino (no tipo) is skipped.
const QUIZ_RE = /^\d+_world_\d+_(?:multiple_choice|true_false|ordenar)$/;

type Manifest = { bancoId?: string; approvedFrom?: string; gate?: string };
type QuizBank = {
  bancoId: string;
  grado: string;
  worldId: string;
  tipo: string;
  version?: number;
  generadoPor?: string;
  pendiente_validacion_docente?: boolean;
  items?: unknown[];
};

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

async function main(): Promise<void> {
  if (!fs.existsSync(APPROVED_DIR)) {
    console.log(
      '✓ content/approved/ no existe — nada que sembrar. Corre `npm run validar-bancos` primero.'
    );
    return;
  }

  const manifests: string[] = fs
    .readdirSync(APPROVED_DIR)
    .filter((f: string) => f.endsWith('.json'));

  let seeded = 0;
  let totalItems = 0;
  let skippedElige = 0;
  let skippedMissing = 0;

  for (const manifestFile of manifests) {
    const manifest = readJson<Manifest>(path.join(APPROVED_DIR, manifestFile));
    const bancoId = manifest.bancoId ?? path.basename(manifestFile, '.json');

    if (!QUIZ_RE.test(bancoId)) {
      skippedElige++;
      continue; // EligeCamino (sin tipo) — fuera de alcance por ahora.
    }

    const sourceFile = manifest.approvedFrom ?? `${bancoId}.json`;
    const sourcePath = path.join(BANKS_DIR, sourceFile);
    if (!fs.existsSync(sourcePath)) {
      skippedMissing++;
      console.warn(`  ⚠ ${bancoId}: falta content/bancos/${sourceFile} — se salta.`);
      continue;
    }

    const bank = readJson<QuizBank>(sourcePath);
    const items = Array.isArray(bank.items) ? bank.items : [];

    await db
      .collection('bancos')
      .doc(bancoId)
      .set(
        {
          bancoId,
          grado: bank.grado,
          worldId: bank.worldId,
          tipo: bank.tipo,
          version: bank.version ?? 1,
          generadoPor: bank.generadoPor ?? 'ia',
          pendiente_validacion_docente: bank.pendiente_validacion_docente ?? true,
          items,
        },
        { merge: true }
      );

    seeded++;
    totalItems += items.length;
    console.log(`  ✓ bancos/${bancoId} (${items.length} ítems)`);
  }

  console.log(
    `\n✅ Bancos sembrados: ${seeded} banco(s), ${totalItems} ítems en total.` +
      (skippedElige ? ` (${skippedElige} EligeCamino omitidos)` : '') +
      (skippedMissing ? ` (${skippedMissing} sin contenido en disco, omitidos)` : '')
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
