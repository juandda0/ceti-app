/**
 * Seeds the shared content banks (R8 / CN05) into Firestore from the content on
 * disk. All three collections are read-only to clients; written only here via the
 * Admin SDK.
 *
 * 1. `bancos` (quiz) and `bancosEligeCamino` (situational) — both gated: their
 *    source of truth is content/approved/*.json, each a manifest
 *    { bancoId, approvedFrom, gate } produced by E3 (scripts/bankGate.mjs).
 *      - QUIZ banks: bancoId matching `\d+_world_\d+_(multiple_choice|true_false|
 *        ordenar)` → written to `bancos/<bancoId>` (merge:true).
 *      - EligeCamino: bancoId matching `\d+_world_\d+` (no tipo) → loaded from
 *        content/bancos/<approvedFrom> and written to
 *        `bancosEligeCamino/<bancoId>` (merge:true).
 * 2. `microteoria` — NOT gated: read directly from content/microteoria/*.json and
 *    written to `microteoria/<grado>_<worldId>` (merge:true).
 *
 * All writes are idempotent (merge:true).
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
const MICROTEORIA_DIR = path.join(ROOT, 'content', 'microteoria');

// Quiz banks (R8/R9): grado_world_N_<tipo>.
const QUIZ_RE = /^\d+_world_\d+_(?:multiple_choice|true_false|ordenar)$/;
// EligeCamino banks (R8): grado_world_N (no tipo).
const ELIGE_RE = /^\d+_world_\d+$/;

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
type EligeCaminoBank = {
  bancoId: string;
  grado: string;
  worldId: string;
  situaciones?: unknown[];
  pendiente_validacion_docente?: boolean;
};
type MicroteoriaBank = {
  grado?: string;
  worldId?: string;
  cards?: unknown[];
  generadoPor?: string;
  pendiente_validacion_docente?: boolean;
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
  let seededElige = 0;
  let totalSituaciones = 0;
  let skippedUnknown = 0;
  let skippedMissing = 0;

  for (const manifestFile of manifests) {
    const manifest = readJson<Manifest>(path.join(APPROVED_DIR, manifestFile));
    const bancoId = manifest.bancoId ?? path.basename(manifestFile, '.json');

    const isQuiz = QUIZ_RE.test(bancoId);
    const isElige = !isQuiz && ELIGE_RE.test(bancoId);
    if (!isQuiz && !isElige) {
      skippedUnknown++;
      console.warn(`  ⚠ ${bancoId}: manifiesto no reconocido (ni quiz ni EligeCamino) — se salta.`);
      continue;
    }

    const sourceFile = manifest.approvedFrom ?? `${bancoId}.json`;
    const sourcePath = path.join(BANKS_DIR, sourceFile);
    if (!fs.existsSync(sourcePath)) {
      skippedMissing++;
      console.warn(`  ⚠ ${bancoId}: falta content/bancos/${sourceFile} — se salta.`);
      continue;
    }

    if (isQuiz) {
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
    } else {
      // EligeCamino: bancoId `${grado}_${worldId}` → bancosEligeCamino/<bancoId>.
      const bank = readJson<EligeCaminoBank>(sourcePath);
      const situaciones = Array.isArray(bank.situaciones) ? bank.situaciones : [];

      await db
        .collection('bancosEligeCamino')
        .doc(bancoId)
        .set(
          {
            bancoId,
            grado: bank.grado,
            worldId: bank.worldId,
            situaciones,
            pendiente_validacion_docente: bank.pendiente_validacion_docente ?? true,
          },
          { merge: true }
        );

      seededElige++;
      totalSituaciones += situaciones.length;
      console.log(`  ✓ bancosEligeCamino/${bancoId} (${situaciones.length} situaciones)`);
    }
  }

  // ---- Micro-teoría (NO pasa por el gate de aprobación) ----------------------
  let seededMicro = 0;
  let totalCards = 0;
  if (fs.existsSync(MICROTEORIA_DIR)) {
    const microFiles: string[] = fs
      .readdirSync(MICROTEORIA_DIR)
      .filter((f: string) => f.endsWith('.json'));

    for (const microFile of microFiles) {
      const bank = readJson<MicroteoriaBank>(path.join(MICROTEORIA_DIR, microFile));
      // Doc id: prefer grado/worldId fields; fall back to the filename.
      const docId =
        bank.grado && bank.worldId
          ? `${bank.grado}_${bank.worldId}`
          : path.basename(microFile, '.json');
      const cards = Array.isArray(bank.cards) ? bank.cards : [];

      await db
        .collection('microteoria')
        .doc(docId)
        .set(
          {
            grado: bank.grado,
            worldId: bank.worldId,
            cards,
            generadoPor: bank.generadoPor ?? 'ia',
            pendiente_validacion_docente: bank.pendiente_validacion_docente ?? true,
          },
          { merge: true }
        );

      seededMicro++;
      totalCards += cards.length;
      console.log(`  ✓ microteoria/${docId} (${cards.length} cards)`);
    }
  } else {
    console.log('  (content/microteoria/ no existe — 0 micro-teorías que sembrar.)');
  }

  console.log(
    `\n✅ Quiz bancos sembrados: ${seeded} banco(s), ${totalItems} ítems en total.` +
      (skippedUnknown ? ` (${skippedUnknown} manifiestos no reconocidos, omitidos)` : '') +
      (skippedMissing ? ` (${skippedMissing} sin contenido en disco, omitidos)` : '')
  );
  console.log(
    `✅ EligeCamino sembrados: ${seededElige} banco(s), ${totalSituaciones} situaciones en total.`
  );
  console.log(`✅ Micro-teorías sembradas: ${seededMicro} doc(s), ${totalCards} cards en total.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
