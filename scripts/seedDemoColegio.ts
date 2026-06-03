/**
 * Seeds an EXAMPLE tenant (colegio "demo") so the dashboards have realistic data.
 * Idempotent (upsert). Run with ADC or a service account:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
 *   $env:GOOGLE_CLOUD_PROJECT = "ceti-d3769"
 *   npx ts-node --project tsconfig.scripts.json scripts/seedDemoColegio.ts
 *
 * Does NOT set anyone's claims (those need a real auth uid). After you sign into
 * the web app, set yourself rector of "demo" (see scripts/setRole.ts).
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
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const COLEGIO = 'demo';
const CURSO = '9A';

const WORLD_COMPETENCIA: Record<string, string> = {
  world_1: 'ingreso',
  world_2: 'presupuesto',
  world_3: 'ahorro',
  world_4: 'credito',
  world_5: 'deuda',
};

type Plan = { label: string; estado: string; worlds: Partial<Record<string, number>> };
const STUDENTS: Record<string, Plan> = {
  s_001: {
    label: 'Estudiante 1',
    estado: 'activo',
    worlds: { world_1: 0.9, world_2: 0.85, world_3: 0.6 },
  },
  s_002: { label: 'Estudiante 2', estado: 'activo', worlds: { world_1: 0.7, world_2: 0.4 } },
  s_003: {
    label: 'Estudiante 3',
    estado: 'activo',
    worlds: { world_1: 0.95, world_2: 0.9, world_3: 0.8, world_4: 0.5 },
  },
  s_004: { label: 'Estudiante 4', estado: 'activo', worlds: { world_1: 0.3 } },
  s_005: { label: 'Estudiante 5', estado: 'activo', worlds: { world_1: 0.8, world_2: 0.75 } },
  s_006: { label: 'Estudiante 6', estado: 'pendiente_autorizacion', worlds: {} },
};

async function main(): Promise<void> {
  const cursoBase = db.doc(`colegios/${COLEGIO}/cursos/${CURSO}`);

  await db
    .doc(`colegios/${COLEGIO}`)
    .set({ nombre: 'Colegio Demo Ceti', sedesEnabled: false, createdAt: NOW }, { merge: true });
  await cursoBase.set(
    { nombre: '9A', grado: '9', profesorUids: [], colaboracionAula: false },
    { merge: true }
  );

  let progressDocs = 0;
  for (const [sid, plan] of Object.entries(STUDENTS)) {
    await cursoBase
      .collection('estudiantes')
      .doc(sid)
      .set({ displayLabel: plan.label, estado: plan.estado, createdAt: NOW }, { merge: true });
    // Authorization record for active students.
    if (plan.estado === 'activo') {
      await db
        .doc(`colegios/${COLEGIO}/autorizaciones/${sid}`)
        .set(
          {
            estado: 'otorgada',
            politicaVersion: 'v1',
            otorgadaAt: NOW,
            canalEvidencia: 'seed-demo',
          },
          { merge: true }
        );
    }
    for (const [worldId, mastery] of Object.entries(plan.worlds)) {
      if (typeof mastery !== 'number') continue;
      await cursoBase
        .collection('estudiantes')
        .doc(sid)
        .collection('progress')
        .doc(worldId)
        .set(
          {
            colegioId: COLEGIO,
            cursoId: CURSO,
            studentId: sid,
            competencia: WORLD_COMPETENCIA[worldId],
            xp: Math.round(mastery * 150),
            nivel: 1 + Math.floor(mastery * 4),
            mastery,
            quizScores: { [worldId]: Math.round(mastery * 100) },
            badges: mastery >= 0.8 ? [`mastery_${WORLD_COMPETENCIA[worldId]}`] : [],
            completed: mastery >= 0.8,
            ...(mastery >= 0.8 ? { completedAt: NOW } : {}),
            updatedAt: NOW,
          },
          { merge: true }
        );
      progressDocs++;
    }
  }

  await db.collection(`colegios/${COLEGIO}/asignaciones`).add({
    worldId: 'world_2',
    target: { tipo: 'curso', cursoId: CURSO },
    fechaInicio: NOW,
    deadline: NOW + 14 * DAY,
    createdByUid: 'seed-demo',
    createdAt: NOW,
  });

  console.log(
    `✅ Demo listo: colegio "${COLEGIO}", curso "${CURSO}", ${Object.keys(STUDENTS).length} estudiantes, ${progressDocs} progresos, 1 asignación.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
