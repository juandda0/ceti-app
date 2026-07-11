/**
 * Seeds an EXAMPLE tenant (colegio "demo") so the dashboards have realistic data.
 * Idempotent (upsert). Run with ADC or a service account:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
 *   $env:GOOGLE_CLOUD_PROJECT = "ceti-d3769"
 *   npx ts-node --project tsconfig.scripts.json scripts/seedDemoColegio.ts
 *
 * Does NOT set anyone's claims (those need a real auth uid). After you sign into
 * the web app, set yourself profesor of "demo" (see scripts/setRole.ts).
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

// Demo students are keyed by a synthetic "uid" (R1: students are keyed by uid).
// Only email + nombre are stored (R4); the grade comes from the course.
type Plan = {
  nombre: string;
  email: string;
  estado: string;
  worlds: Partial<Record<string, number>>;
};
const STUDENTS: Record<string, Plan> = {
  demo_u001: {
    nombre: 'Estudiante 1',
    email: 'estudiante1@demo.ceti',
    estado: 'activo',
    worlds: { world_1: 0.9, world_2: 0.85, world_3: 0.6 },
  },
  demo_u002: {
    nombre: 'Estudiante 2',
    email: 'estudiante2@demo.ceti',
    estado: 'activo',
    worlds: { world_1: 0.7, world_2: 0.4 },
  },
  demo_u003: {
    nombre: 'Estudiante 3',
    email: 'estudiante3@demo.ceti',
    estado: 'activo',
    worlds: { world_1: 0.95, world_2: 0.9, world_3: 0.8, world_4: 0.5 },
  },
  demo_u004: {
    nombre: 'Estudiante 4',
    email: 'estudiante4@demo.ceti',
    estado: 'activo',
    worlds: { world_1: 0.3 },
  },
  demo_u005: {
    nombre: 'Estudiante 5',
    email: 'estudiante5@demo.ceti',
    estado: 'activo',
    worlds: { world_1: 0.8, world_2: 0.75 },
  },
  demo_u006: {
    nombre: 'Estudiante 6',
    email: 'estudiante6@demo.ceti',
    estado: 'pendiente_atestacion',
    worlds: {},
  },
};

async function main(): Promise<void> {
  const cursoBase = db.doc(`colegios/${COLEGIO}/cursos/${CURSO}`);

  await db
    .doc(`colegios/${COLEGIO}`)
    .set({ nombre: 'Colegio Demo Ceti', sedesEnabled: false, createdAt: NOW }, { merge: true });
  await cursoBase.set({ nombre: '9A', grado: '9', profesorUids: [] }, { merge: true });

  let progressDocs = 0;
  for (const [uid, plan] of Object.entries(STUDENTS)) {
    const activo = plan.estado === 'activo';
    await cursoBase
      .collection('estudiantes')
      .doc(uid)
      .set(
        {
          email: plan.email,
          nombre: plan.nombre,
          estado: plan.estado,
          atestado: activo,
          ...(activo ? { atestadoPor: 'seed-demo', atestadoAt: NOW, politicaVersion: 'v1' } : {}),
          joinedAt: NOW,
        },
        { merge: true }
      );
    for (const [worldId, mastery] of Object.entries(plan.worlds)) {
      if (typeof mastery !== 'number') continue;
      await cursoBase
        .collection('estudiantes')
        .doc(uid)
        .collection('progress')
        .doc(worldId)
        .set(
          {
            colegioId: COLEGIO,
            cursoId: CURSO,
            uid,
            competencia: WORLD_COMPETENCIA[worldId],
            mastery,
            quizScores: { [worldId]: Math.round(mastery * 100) },
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
