/**
 * Seeds Ceti's Demo Mode (RQ-DM): a synthetic, realistic, Spanish demo school
 * `demo-colegio` so every dashboard (admin / rector / coordinador / profesor /
 * estudiante) is full of believable data. Idempotent (upsert). Run with ADC or a
 * service account:
 *
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
 *   $env:GOOGLE_CLOUD_PROJECT = "ceti-d3769"
 *   npx ts-node --project tsconfig.scripts.json scripts/seedDemo.ts
 *
 * Identity is by Auth uid (R1); only email + nombre are stored per student (R4).
 * Lightweight attestation is pre-set (no acudiente PII, R6). The 5 fixed demo
 * login users get FIXED uids + claims (must match functions DEMO_USERS); claims
 * are set only here via Admin SDK (R2). Aggregates are computed ONLY from the
 * ~60 synthetic students and NEVER include `demo-estudiante` (RQ-DM06/D-DEMO-03):
 * the demo student lives in demo-9A at zero progress so it can be reset on login.
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

const auth = admin.auth();
const db = admin.firestore();
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const COLEGIO = 'demo-colegio';
const COLEGIO_NOMBRE = 'Colegio Demo Ceti';

const WORLDS = ['world_1', 'world_2', 'world_3', 'world_4', 'world_5'] as const;
type WorldId = (typeof WORLDS)[number];

const WORLD_COMPETENCIA: Record<WorldId, string> = {
  world_1: 'ingreso',
  world_2: 'presupuesto',
  world_3: 'ahorro',
  world_4: 'credito',
  world_5: 'deuda',
};

// A couple of Elige-camino situation ids per world, for the aggregate counters.
const WORLD_SITUACIONES: Record<WorldId, string[]> = {
  world_1: ['ingreso_s1', 'ingreso_s2'],
  world_2: ['presupuesto_s1', 'presupuesto_s2'],
  world_3: ['ahorro_s1', 'ahorro_s2'],
  world_4: ['credito_s1', 'credito_s2'],
  world_5: ['deuda_s1', 'deuda_s2'],
};

// ---- Spanish synthetic name pool (PII-free: these are fabricated demo names) ----
const NOMBRES = [
  'Sofía',
  'Mateo',
  'Valentina',
  'Santiago',
  'Isabella',
  'Sebastián',
  'Camila',
  'Nicolás',
  'Mariana',
  'Samuel',
  'Gabriela',
  'Tomás',
  'Daniela',
  'Andrés',
  'Luciana',
  'Emiliano',
  'Antonella',
  'Martín',
  'Salomé',
  'Juan David',
];
const APELLIDOS = [
  'García',
  'Rodríguez',
  'Martínez',
  'López',
  'González',
  'Pérez',
  'Sánchez',
  'Ramírez',
  'Torres',
  'Flores',
  'Rivera',
  'Gómez',
  'Díaz',
  'Vargas',
  'Castro',
  'Romero',
  'Suárez',
  'Moreno',
  'Muñoz',
  'Ortiz',
];

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function emailFrom(nombre: string, apellido: string, n: number): string {
  const first = stripAccents(nombre).toLowerCase().replace(/\s+/g, '');
  const last = stripAccents(apellido).toLowerCase().replace(/\s+/g, '');
  return `${first}.${last}${n}@demo.ceti`;
}

/** Deterministic pseudo-random in [0,1) from a seed (so re-runs are stable). */
function rng(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ---- Courses ----
type CourseDef = {
  cursoId: string;
  nombre: string;
  grado: '9' | '10' | '11';
  codigo: string;
  profesorUids: string[];
  prefix: string; // uid prefix for synthetic students, e.g. 'demo-9A'
};

const COURSES: CourseDef[] = [
  {
    cursoId: 'demo-9A',
    nombre: '9A',
    grado: '9',
    codigo: 'DEMO9A',
    profesorUids: ['demo-profesor'],
    prefix: 'demo-9A',
  },
  {
    cursoId: 'demo-10A',
    nombre: '10A',
    grado: '10',
    codigo: 'DEMO10A',
    profesorUids: ['demo-profesor-2'],
    prefix: 'demo-10A',
  },
  {
    cursoId: 'demo-11A',
    nombre: '11A',
    grado: '11',
    codigo: 'DEMO11A',
    profesorUids: ['demo-profesor-3'],
    prefix: 'demo-11A',
  },
];

const STUDENTS_PER_COURSE = 20;

// ---- The 5 fixed demo login users (uids/claims must match functions DEMO_USERS) ----
const DEMO_USERS: { key: string; uid: string; claims: Record<string, unknown> }[] = [
  { key: 'admin', uid: 'demo-admin', claims: { role: 'admin', demo: true, colegioId: COLEGIO } },
  { key: 'rector', uid: 'demo-rector', claims: { role: 'rector', demo: true, colegioId: COLEGIO } },
  {
    key: 'coordinador',
    uid: 'demo-coordinador',
    claims: { role: 'coordinador', demo: true, colegioId: COLEGIO },
  },
  {
    key: 'profesor',
    uid: 'demo-profesor',
    claims: { role: 'profesor', demo: true, colegioId: COLEGIO },
  },
  {
    key: 'estudiante',
    uid: 'demo-estudiante',
    claims: { role: 'estudiante', demo: true, colegioId: COLEGIO, cursoId: 'demo-9A' },
  },
];

// Extra (non-login) teacher uids so each course has a profesor in profesorUids.
const EXTRA_PROFESORES: { uid: string; email: string; nombre: string }[] = [
  { uid: 'demo-profesor-2', email: 'profesor2@demo.ceti', nombre: 'Profesor Demo 2' },
  { uid: 'demo-profesor-3', email: 'profesor3@demo.ceti', nombre: 'Profesor Demo 3' },
];

/** Ensures an Auth user exists with the FIXED uid (creates it if missing). */
async function ensureUserWithUid(uid: string, email: string): Promise<void> {
  try {
    await auth.getUser(uid);
  } catch {
    await auth.createUser({ uid, email, emailVerified: true });
    console.log(`  · pre-creada cuenta Auth ${uid} (${email})`);
  }
}

async function setClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
  await auth.setCustomUserClaims(uid, claims);
  await db.doc(`membership/${uid}`).set({ ...claims, claimsUpdatedAt: NOW }, { merge: true });
}

// A synthetic student plan: how far they got across the 5 worlds.
type StudentPlan = {
  uid: string;
  nombre: string;
  email: string;
  // mastery per world (only worlds the student has reached are present)
  worlds: Partial<Record<WorldId, number>>;
};

/**
 * Builds ~20 believable students for a course: a spread of "finished all 5",
 * "mid-way", and "just started", with varied mastery so charts look real.
 */
function buildCoursePlans(course: CourseDef, seedBase: number): StudentPlan[] {
  const plans: StudentPlan[] = [];
  for (let i = 0; i < STUDENTS_PER_COURSE; i++) {
    const idx = String(i + 1).padStart(2, '0');
    const uid = `${course.prefix}-s${idx}`;
    const nombre = NOMBRES[i % NOMBRES.length];
    const apellido = APELLIDOS[(i * 7 + 3) % APELLIDOS.length];
    const email = emailFrom(nombre, apellido, i + 1);

    // Decide a profile by a deterministic bucket so the cohort is varied:
    //  ~30% finished all 5, ~45% mid-way, ~25% just started.
    const r = rng(seedBase + i);
    const worlds: Partial<Record<WorldId, number>> = {};
    let reached: number;
    let baseMastery: number;
    if (r < 0.3) {
      reached = 5; // completed all worlds
      baseMastery = 0.82 + rng(seedBase + i + 100) * 0.16; // 0.82..0.98
    } else if (r < 0.75) {
      reached = 2 + Math.floor(rng(seedBase + i + 200) * 3); // 2..4 worlds in progress
      baseMastery = 0.45 + rng(seedBase + i + 300) * 0.35; // 0.45..0.80
    } else {
      reached = 1; // just started
      baseMastery = 0.1 + rng(seedBase + i + 400) * 0.3; // 0.10..0.40
    }
    for (let w = 0; w < reached; w++) {
      const worldId = WORLDS[w];
      // mastery decays a little across later worlds, with per-world jitter.
      const jitter = (rng(seedBase + i + w * 17) - 0.5) * 0.12;
      const m = clamp01(baseMastery - w * 0.05 + jitter);
      worlds[worldId] = Math.round(m * 100) / 100;
    }
    plans.push({ uid, nombre: `${nombre} ${apellido}`, email, worlds });
  }
  return plans;
}

function masteryToProgressDoc(
  uid: string,
  cursoId: string,
  worldId: WorldId,
  mastery: number
): Record<string, unknown> {
  const competencia = WORLD_COMPETENCIA[worldId];
  const completed = mastery >= 0.8;
  return {
    colegioId: COLEGIO,
    cursoId,
    uid,
    competencia,
    xp: Math.round(mastery * 150),
    nivel: 1 + Math.floor(mastery * 4),
    mastery,
    quizScores: { [worldId]: Math.round(mastery * 100) },
    badges: mastery >= 0.8 ? [`mastery_${competencia}`] : [],
    completed,
    ...(completed ? { completedAt: NOW - Math.round(rng(NOW + mastery) * 20 * DAY) } : {}),
    updatedAt: NOW,
  };
}

/** A finished student (all 5 worlds) — used to decide who gets a post-test. */
function finishedAllFive(plan: StudentPlan): boolean {
  return WORLDS.every((w) => typeof plan.worlds[w] === 'number');
}

/** Builds a pre/post impact breakdown that loosely tracks the student's mastery. */
function impactBreakdown(plan: StudentPlan, lift: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of WORLDS) {
    const competencia = WORLD_COMPETENCIA[w];
    const m = plan.worlds[w] ?? 0.2;
    // each competency is out of 3 (5 competencias × 3 = total 15)
    const raw = Math.round(clamp01(m + lift) * 3);
    out[competencia] = Math.max(0, Math.min(3, raw));
  }
  return out;
}

function sumBreakdown(b: Record<string, number>): number {
  return Object.values(b).reduce((a, v) => a + v, 0);
}

async function main(): Promise<void> {
  // ---- Colegio ----
  await db
    .doc(`colegios/${COLEGIO}`)
    .set({ nombre: COLEGIO_NOMBRE, sedesEnabled: false, createdAt: NOW }, { merge: true });

  // ---- Fixed demo login users: Auth + claims + membership ----
  for (const u of DEMO_USERS) {
    const email = `${u.key}.demo@demo.ceti`;
    await ensureUserWithUid(u.uid, email);
    await setClaims(u.uid, u.claims);
  }
  // Extra (non-login) teachers: Auth + optional profesor claim.
  for (const p of EXTRA_PROFESORES) {
    await ensureUserWithUid(p.uid, p.email);
    await setClaims(p.uid, { role: 'profesor', demo: true, colegioId: COLEGIO });
  }

  const summary: Record<string, { estudiantes: number; progresos: number; postTests: number }> = {};

  for (let c = 0; c < COURSES.length; c++) {
    const course = COURSES[c];
    const cursoBase = db.doc(`colegios/${COLEGIO}/cursos/${course.cursoId}`);

    // ---- Curso ----
    await cursoBase.set(
      {
        nombre: course.nombre,
        grado: course.grado,
        profesorUids: course.profesorUids,
        colaboracionAula: false,
        codigo: course.codigo,
        createdAt: NOW,
      },
      { merge: true }
    );

    // ---- Class join code lookup ----
    await db.doc(`classCodes/${course.codigo}`).set(
      {
        colegioId: COLEGIO,
        cursoId: course.cursoId,
        createdAt: NOW,
      },
      { merge: true }
    );

    // ---- Synthetic students (the only ones that feed aggregates) ----
    const plans = buildCoursePlans(course, (c + 1) * 1000);

    // Aggregate accumulators per competencia (synthetic-only, RQ-DM06).
    const masterySum: Record<string, number> = {};
    const masteryCount: Record<string, number> = {};
    const eligeCamino: Record<string, { opcionA: number; opcionB: number }> = {};
    for (const w of WORLDS) {
      for (const sit of WORLD_SITUACIONES[w]) {
        eligeCamino[sit] = { opcionA: 0, opcionB: 0 };
      }
    }

    let progresos = 0;
    let postTests = 0;

    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      const studentRef = cursoBase.collection('estudiantes').doc(plan.uid);

      // Roster doc — only email + nombre (R4); active + pre-attested (R6).
      await studentRef.set(
        {
          email: plan.email,
          nombre: plan.nombre,
          estado: 'activo',
          atestado: true,
          atestadoPor: 'seed-demo',
          atestadoAt: NOW,
          politicaVersion: 'v1',
          joinedAt: NOW,
        },
        { merge: true }
      );

      // Progress per reached world.
      for (const w of WORLDS) {
        const mastery = plan.worlds[w];
        if (typeof mastery !== 'number') continue;
        await studentRef
          .collection('progress')
          .doc(w)
          .set(masteryToProgressDoc(plan.uid, course.cursoId, w, mastery), { merge: true });
        progresos++;

        // Feed aggregate accumulators.
        const competencia = WORLD_COMPETENCIA[w];
        masterySum[competencia] = (masterySum[competencia] ?? 0) + mastery;
        masteryCount[competencia] = (masteryCount[competencia] ?? 0) + 1;

        // Elige-camino A/B counters: each reached world contributes one vote.
        for (const sit of WORLD_SITUACIONES[w]) {
          const pick = rng((c + 1) * 9000 + i * 31 + sit.length);
          if (pick < 0.5) eligeCamino[sit].opcionA++;
          else eligeCamino[sit].opcionB++;
        }
      }

      // Impact tests: EVERY synthetic student has a `pre`; finishers also get
      // a `post` with a higher score (positive pre→post delta).
      const preBreakdown = impactBreakdown(plan, -0.15);
      await studentRef
        .collection('impactTest')
        .doc('pre')
        .set(
          {
            score: sumBreakdown(preBreakdown),
            total: 15,
            takenAt: NOW - 30 * DAY,
            breakdown: preBreakdown,
          },
          { merge: true }
        );
      if (finishedAllFive(plan)) {
        const postBreakdown = impactBreakdown(plan, 0.25);
        await studentRef
          .collection('impactTest')
          .doc('post')
          .set(
            {
              score: sumBreakdown(postBreakdown),
              total: 15,
              takenAt: NOW - 2 * DAY,
              breakdown: postBreakdown,
            },
            { merge: true }
          );
        postTests++;
      }
    }

    // ---- Aggregates per competencia (synthetic-only; demo-estudiante excluded) ----
    for (const w of WORLDS) {
      const competencia = WORLD_COMPETENCIA[w];
      const count = masteryCount[competencia] ?? 0;
      const masteryPromedio =
        count > 0 ? Math.round((masterySum[competencia] / count) * 100) / 100 : 0;
      const sitEntries: Record<string, { opcionA: number; opcionB: number }> = {};
      for (const sit of WORLD_SITUACIONES[w]) sitEntries[sit] = eligeCamino[sit];
      await cursoBase.collection('agregados').doc(competencia).set(
        {
          competencia,
          masteryPromedio,
          eligeCamino: sitEntries,
          updatedAt: NOW,
        },
        { merge: true }
      );
    }

    summary[course.cursoId] = { estudiantes: plans.length, progresos, postTests };
  }

  // ---- The demo student (RQ-DM04): in demo-9A, ZERO progress, EXCLUDED from aggregates ----
  await db.doc(`colegios/${COLEGIO}/cursos/demo-9A/estudiantes/demo-estudiante`).set(
    {
      email: 'estudiante.demo@demo.ceti',
      nombre: 'Estudiante Demo',
      estado: 'activo',
      atestado: true,
      atestadoPor: 'seed-demo',
      atestadoAt: NOW,
      politicaVersion: 'v1',
      joinedAt: NOW,
    },
    { merge: true }
  );
  // No progress and no impactTest docs are written for demo-estudiante.

  // ---- Summary ----
  console.log(`✅ Demo Mode listo: colegio "${COLEGIO}" (${COLEGIO_NOMBRE})`);
  console.log(`   Usuarios demo fijos: ${DEMO_USERS.map((u) => u.uid).join(', ')}`);
  console.log(`   Profesores extra:    ${EXTRA_PROFESORES.map((p) => p.uid).join(', ')}`);
  let totalEst = 0;
  let totalProg = 0;
  let totalPost = 0;
  for (const course of COURSES) {
    const s = summary[course.cursoId];
    totalEst += s.estudiantes;
    totalProg += s.progresos;
    totalPost += s.postTests;
    console.log(
      `   ${course.cursoId} (${course.nombre}, grado ${course.grado}, código ${course.codigo}): ` +
        `${s.estudiantes} estudiantes sintéticos, ${s.progresos} progresos, ${s.postTests} post-tests`
    );
  }
  console.log(
    `   Totales: ${totalEst} estudiantes sintéticos (+1 demo-estudiante a cero), ` +
      `${totalProg} progresos, ${totalPost} post-tests, 3 cursos.`
  );
  console.log('   demo-estudiante NO cuenta en agregados (RQ-DM06).');
  console.log('   Cada usuario demo debe (re)iniciar sesión para aplicar su rol.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌', e.message ?? e);
    process.exit(1);
  });
