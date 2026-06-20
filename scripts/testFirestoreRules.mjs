/**
 * Firestore rules role-scenario tests (B2B2C multi-tenant, 5 roles).
 * Run via the emulator so FIRESTORE_EMULATOR_HOST is set:
 *   firebase emulators:exec --only firestore --project demo-ceti "node scripts/testFirestoreRules.mjs"
 *
 * Exits non-zero on any failed assertion. Standalone (no jest). Covers the §1.3
 * matrix: tenant isolation, the 5 roles, uid-identity (R1), the Ley 1581
 * attestation gate, rector excluded from nominal data, the collection-group
 * report rule, aggregates, and progress write guards. At least one allow + one
 * deny per critical cell.
 */
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collectionGroup,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-ceti',
  firestore: { rules: readFileSync('firestore.rules', 'utf8') },
});

let passed = 0;
let failed = 0;
async function check(name, promise) {
  try {
    await promise;
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}\n      ${e.message ?? e}`);
  }
}

// Auth contexts (second arg = custom claims). Student identity = the uid (R1).
const adminG = env.authenticatedContext('uAdmin', { role: 'admin' }).firestore();
// Demo cage (RQ-DM05): the demo admin carries demo:true + colegioId 'demo-colegio'.
const demoAdmin = env
  .authenticatedContext('demo-admin', { role: 'admin', demo: true, colegioId: 'demo-colegio' })
  .firestore();
const rectorA = env.authenticatedContext('uRectorA', { role: 'rector', colegioId: 'A' }).firestore();
const coordA = env
  .authenticatedContext('uCoordA', { role: 'coordinador', colegioId: 'A' })
  .firestore();
const profA1 = env
  .authenticatedContext('uProfA1', { role: 'profesor', colegioId: 'A' })
  .firestore();
const profA2 = env
  .authenticatedContext('uProfA2', { role: 'profesor', colegioId: 'A' })
  .firestore();
const stuA1 = env
  .authenticatedContext('uStuA1', { role: 'estudiante', colegioId: 'A', cursoId: 'c1' })
  .firestore();
const stuA2 = env
  .authenticatedContext('uStuA2', { role: 'estudiante', colegioId: 'A', cursoId: 'c1' })
  .firestore();
const stuA3 = env
  .authenticatedContext('uStuA3', { role: 'estudiante', colegioId: 'A', cursoId: 'c1' })
  .firestore();
const stuA4 = env
  .authenticatedContext('uStuA4', { role: 'estudiante', colegioId: 'A', cursoId: 'c1' })
  .firestore();
const rectorB = env.authenticatedContext('uRectorB', { role: 'rector', colegioId: 'B' }).firestore();
// Leaderboard (V2) contexts: students carry a cursoId claim.
const stuLb1 = env
  .authenticatedContext('uLb1', { role: 'estudiante', colegioId: 'A', cursoId: 'cLbOn' })
  .firestore();
const stuLb2 = env
  .authenticatedContext('uLb2', { role: 'estudiante', colegioId: 'A', cursoId: 'cLbOn' })
  .firestore();
const stuLb4 = env
  .authenticatedContext('uLb4', { role: 'estudiante', colegioId: 'A', cursoId: 'cLbOff' })
  .firestore();

const progPath = (cid, curso, uid, w) =>
  `colegios/${cid}/cursos/${curso}/estudiantes/${uid}/progress/${w}`;
const validProgress = {
  colegioId: 'A',
  cursoId: 'c1',
  uid: 'uStuA1',
  competencia: 'ahorro',
  xp: 100,
  nivel: 2,
  mastery: 0.5,
  quizScores: { w1: 80 },
  badges: ['first'],
  completed: false,
  updatedAt: 1,
};

// Seed with rules disabled.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'colegios/A'), { nombre: 'Colegio A', sedesEnabled: false, createdAt: 1 });
  await setDoc(doc(db, 'colegios/B'), { nombre: 'Colegio B', sedesEnabled: false, createdAt: 1 });
  await setDoc(doc(db, 'colegios/A/cursos/c1'), {
    nombre: '9A',
    grado: '9',
    profesorUids: ['uProfA1'],
    colaboracionAula: false,
  });
  await setDoc(doc(db, 'colegios/A/cursos/c1/estudiantes/uStuA1'), {
    email: 'a1@demo.ceti',
    nombre: 'Est 1',
    estado: 'activo',
    atestado: true,
    joinedAt: 1,
  });
  // uStuA3 exists but is NOT yet attested (Ley 1581 gate).
  await setDoc(doc(db, 'colegios/A/cursos/c1/estudiantes/uStuA3'), {
    email: 'a3@demo.ceti',
    nombre: 'Est 3',
    estado: 'pendiente_atestacion',
    atestado: false,
    joinedAt: 1,
  });
  // uStuA4 is a suppressed roster slot — must not be able to write.
  await setDoc(doc(db, 'colegios/A/cursos/c1/estudiantes/uStuA4'), {
    email: 'a4@demo.ceti',
    nombre: 'Est 4',
    estado: 'suprimido',
    atestado: false,
    joinedAt: 1,
  });
  await setDoc(doc(db, progPath('A', 'c1', 'uStuA1', 'w1')), validProgress);
  await setDoc(doc(db, 'colegios/A/cursos/c1/agregados/ag1'), {
    competencia: 'ahorro',
    masteryPromedio: 0.5,
    updatedAt: 1,
  });
  await setDoc(doc(db, 'membership/uStuA1'), { role: 'estudiante', colegioId: 'A', cursoId: 'c1' });
  await setDoc(doc(db, 'colegios/A/sedes/sede1'), { nombre: 'Sede 1' });
  await setDoc(doc(db, 'classCodes/CODE1'), { colegioId: 'A', cursoId: 'c1' });
  // Shared content bank (R8): doc id is `${grado}_${worldId}_${tipo}`.
  await setDoc(doc(db, 'bancos/9_world_1_multiple_choice'), {
    bancoId: '9_world_1_multiple_choice',
    grado: '9',
    worldId: 'world_1',
    tipo: 'multiple_choice',
    version: 1,
    generadoPor: 'ia',
    pendiente_validacion_docente: true,
    items: [],
  });
  // Leaderboard (V2): two courses, collaboration on vs off, with active students.
  await setDoc(doc(db, 'colegios/A/cursos/cLbOn'), {
    nombre: 'Lb On',
    grado: '9',
    profesorUids: [],
    colaboracionAula: true,
  });
  await setDoc(doc(db, 'colegios/A/cursos/cLbOff'), {
    nombre: 'Lb Off',
    grado: '9',
    profesorUids: [],
    colaboracionAula: false,
  });
  for (const [curso, uid] of [
    ['cLbOn', 'uLb1'],
    ['cLbOn', 'uLb2'],
    ['cLbOff', 'uLb3'],
    ['cLbOff', 'uLb4'],
  ]) {
    await setDoc(doc(db, `colegios/A/cursos/${curso}/estudiantes/${uid}`), {
      email: `${uid}@demo.ceti`,
      nombre: uid,
      estado: 'activo',
      atestado: true,
      joinedAt: 1,
    });
  }
  await setDoc(doc(db, 'colegios/A/cursos/cLbOn/leaderboard/uLb1'), {
    uid: 'uLb1',
    displayLabel: 'lb1',
    xp: 100,
    updatedAt: 1,
  });
  await setDoc(doc(db, 'colegios/A/cursos/cLbOff/leaderboard/uLb3'), {
    uid: 'uLb3',
    displayLabel: 'lb3',
    xp: 100,
    updatedAt: 1,
  });
  // Demo colegio (RQ-DM): the cage confines demo tokens here.
  await setDoc(doc(db, 'colegios/demo-colegio'), {
    nombre: 'Colegio Demo Ceti',
    sedesEnabled: false,
    createdAt: 1,
  });
  await setDoc(doc(db, 'colegios/demo-colegio/cursos/dc1'), {
    nombre: 'Demo 9A',
    grado: '9',
    profesorUids: [],
    colaboracionAula: false,
  });
  await setDoc(doc(db, 'colegios/demo-colegio/cursos/dc1/estudiantes/demo-estudiante'), {
    email: 'demo@demo.ceti',
    nombre: 'Demo Estudiante',
    estado: 'activo',
    atestado: true,
    joinedAt: 1,
  });
});

console.log('Tenant isolation:');
await check('rector A reads own colegio', assertSucceeds(getDoc(doc(rectorA, 'colegios/A'))));
await check('student A reads own colegio', assertSucceeds(getDoc(doc(stuA1, 'colegios/A'))));
await check('rector B cannot read colegio A', assertFails(getDoc(doc(rectorB, 'colegios/A'))));
await check('admin reads any colegio (global)', assertSucceeds(getDoc(doc(adminG, 'colegios/A'))));

console.log('Structure provisioning (admin-only):');
await check(
  'admin creates a colegio',
  assertSucceeds(setDoc(doc(adminG, 'colegios/X'), { nombre: 'X', sedesEnabled: false, createdAt: 1 }))
);
await check(
  'coordinador cannot create a curso (structure = admin)',
  assertFails(
    setDoc(doc(coordA, 'colegios/A/cursos/cNew'), {
      nombre: 'cNew',
      grado: '9',
      profesorUids: [],
      colaboracionAula: false,
    })
  )
);
await check(
  'admin creates a curso',
  assertSucceeds(
    setDoc(doc(adminG, 'colegios/A/cursos/cAdmin'), {
      nombre: 'cAdmin',
      grado: '9',
      profesorUids: [],
      colaboracionAula: false,
    })
  )
);

console.log('Roster nominal read (rector EXCLUDED — only aggregates):');
await check(
  'coordinador reads roster',
  assertSucceeds(getDoc(doc(coordA, 'colegios/A/cursos/c1/estudiantes/uStuA1')))
);
await check(
  'teacher of course reads roster',
  assertSucceeds(getDoc(doc(profA1, 'colegios/A/cursos/c1/estudiantes/uStuA1')))
);
await check(
  'rector CANNOT read nominal roster',
  assertFails(getDoc(doc(rectorA, 'colegios/A/cursos/c1/estudiantes/uStuA1')))
);
await check(
  'student reads own roster doc',
  assertSucceeds(getDoc(doc(stuA1, 'colegios/A/cursos/c1/estudiantes/uStuA1')))
);
await check(
  'student cannot read another student roster doc',
  assertFails(getDoc(doc(stuA2, 'colegios/A/cursos/c1/estudiantes/uStuA1')))
);
await check(
  'roster is Function-only: coordinador cannot client-write it',
  assertFails(
    setDoc(
      doc(coordA, 'colegios/A/cursos/c1/estudiantes/uStuA1'),
      { atestado: true },
      { merge: true }
    )
  )
);

console.log('Student progress read:');
await check('student reads own progress', assertSucceeds(getDoc(doc(stuA1, progPath('A', 'c1', 'uStuA1', 'w1')))));
await check(
  'student cannot read another student progress',
  assertFails(getDoc(doc(stuA2, progPath('A', 'c1', 'uStuA1', 'w1'))))
);
await check(
  'teacher of course reads student progress',
  assertSucceeds(getDoc(doc(profA1, progPath('A', 'c1', 'uStuA1', 'w1'))))
);
await check(
  'teacher NOT of course cannot read it directly',
  assertFails(getDoc(doc(profA2, progPath('A', 'c1', 'uStuA1', 'w1'))))
);
await check(
  'rector cannot read nominal progress',
  assertFails(getDoc(doc(rectorA, progPath('A', 'c1', 'uStuA1', 'w1'))))
);

console.log('Collection-group report rule (rector EXCLUDED):');
const cg = (db) => getDocs(query(collectionGroup(db, 'progress'), where('colegioId', '==', 'A')));
await check('coordinador collection-group read', assertSucceeds(cg(coordA)));
await check('admin collection-group read', assertSucceeds(cg(adminG)));
await check('rector collection-group read DENIED (nominal)', assertFails(cg(rectorA)));
await check('profesor not-of-course collection-group denied', assertFails(cg(profA2)));
await check('rector B collection-group on A denied', assertFails(cg(rectorB)));

console.log('Student progress write guards:');
await check(
  'student writes valid own progress',
  assertSucceeds(setDoc(doc(stuA1, progPath('A', 'c1', 'uStuA1', 'w2')), { ...validProgress }))
);
await check(
  'mastery > 1 rejected',
  assertFails(setDoc(doc(stuA1, progPath('A', 'c1', 'uStuA1', 'w3')), { ...validProgress, mastery: 5 }))
);
await check(
  'spoofed uid rejected',
  assertFails(setDoc(doc(stuA1, progPath('A', 'c1', 'uStuA1', 'w4')), { ...validProgress, uid: 'uStuA2' }))
);
await check(
  'write into non-existent roster slot rejected',
  assertFails(setDoc(doc(stuA2, progPath('A', 'c1', 'uStuA2', 'w1')), { ...validProgress, uid: 'uStuA2' }))
);
await check(
  'Ley 1581: unattested (pendiente) student cannot write progress',
  assertFails(
    setDoc(doc(stuA3, progPath('A', 'c1', 'uStuA3', 'w1')), { ...validProgress, uid: 'uStuA3' })
  )
);
await check(
  'Ley 1581: suprimido student cannot write progress',
  assertFails(
    setDoc(doc(stuA4, progPath('A', 'c1', 'uStuA4', 'w1')), { ...validProgress, uid: 'uStuA4' })
  )
);
await check(
  'progress cannot be deleted by the student',
  assertFails(deleteDoc(doc(stuA1, progPath('A', 'c1', 'uStuA1', 'w1'))))
);

console.log('Impact pre/post test (RQ-TS):');
const impactPath = (uid, fase) => `colegios/A/cursos/c1/estudiantes/${uid}/impactTest/${fase}`;
const validImpact = { score: 6, total: 10, takenAt: 1, breakdown: { ahorro: 3 } };
await check(
  'active student writes own pre-test',
  assertSucceeds(setDoc(doc(stuA1, impactPath('uStuA1', 'pre')), validImpact))
);
await check(
  'unattested student cannot write impact test',
  assertFails(setDoc(doc(stuA3, impactPath('uStuA3', 'pre')), validImpact))
);
await check(
  'teacher reads student impact test',
  assertSucceeds(getDoc(doc(profA1, impactPath('uStuA1', 'pre'))))
);

console.log('Aggregates (rector ALLOWED, students denied):');
await check(
  'rector reads aggregates',
  assertSucceeds(getDoc(doc(rectorA, 'colegios/A/cursos/c1/agregados/ag1')))
);
await check(
  'coordinador reads aggregates',
  assertSucceeds(getDoc(doc(coordA, 'colegios/A/cursos/c1/agregados/ag1')))
);
await check(
  'student cannot read aggregates',
  assertFails(getDoc(doc(stuA1, 'colegios/A/cursos/c1/agregados/ag1')))
);
await check(
  'client cannot write aggregates (Function only)',
  assertFails(setDoc(doc(coordA, 'colegios/A/cursos/c1/agregados/ag2'), { updatedAt: 1 }))
);

console.log('Course update field guard:');
await check(
  'teacher toggles colaboracionAula',
  assertSucceeds(setDoc(doc(profA1, 'colegios/A/cursos/c1'), { colaboracionAula: true }, { merge: true }))
);
await check(
  'teacher cannot change profesorUids',
  assertFails(
    setDoc(doc(profA1, 'colegios/A/cursos/c1'), { profesorUids: ['uProfA1', 'uProfA2'] }, { merge: true })
  )
);
await check(
  'coordinador toggles colaboracionAula',
  assertSucceeds(setDoc(doc(coordA, 'colegios/A/cursos/c1'), { colaboracionAula: false }, { merge: true }))
);
await check(
  'rector cannot toggle colaboracionAula',
  assertFails(setDoc(doc(rectorA, 'colegios/A/cursos/c1'), { colaboracionAula: true }, { merge: true }))
);

console.log('Assignments:');
const asigPath = 'colegios/A/asignaciones/a1';
const asig = { worldId: 'world_1', target: { tipo: 'curso', cursoId: 'c1' }, fechaInicio: 1, deadline: 2, createdByUid: 'uProfA1', createdAt: 1 };
await check('teacher of course creates assignment', assertSucceeds(setDoc(doc(profA1, asigPath), asig)));
await check('coordinador creates assignment', assertSucceeds(setDoc(doc(coordA, 'colegios/A/asignaciones/aC'), asig)));
await check(
  'teacher NOT of course cannot create assignment',
  assertFails(setDoc(doc(profA2, 'colegios/A/asignaciones/aX'), asig))
);
await check('student reads assignment', assertSucceeds(getDoc(doc(stuA1, asigPath))));
await check(
  'student cannot create assignment',
  assertFails(setDoc(doc(stuA2, 'colegios/A/asignaciones/a2'), asig))
);
await check('rector B cannot read A assignment', assertFails(getDoc(doc(rectorB, asigPath))));

console.log('Membership:');
await check('user reads own membership', assertSucceeds(getDoc(doc(stuA1, 'membership/uStuA1'))));
await check('user cannot read other membership', assertFails(getDoc(doc(stuA2, 'membership/uStuA1'))));
await check(
  'client cannot write membership',
  assertFails(setDoc(doc(stuA1, 'membership/uStuA1'), { role: 'rector', colegioId: 'A' }))
);

console.log('Class codes (deny-all to clients):');
await check('client cannot read classCodes', assertFails(getDoc(doc(stuA1, 'classCodes/CODE1'))));
await check(
  'client cannot write classCodes',
  assertFails(setDoc(doc(stuA1, 'classCodes/NEW'), { colegioId: 'A', cursoId: 'c1' }))
);

console.log('Sedes (dormant):');
await check('staff reads sede', assertSucceeds(getDoc(doc(profA1, 'colegios/A/sedes/sede1'))));
await check('student cannot read sede', assertFails(getDoc(doc(stuA1, 'colegios/A/sedes/sede1'))));
await check(
  'client cannot write sede',
  assertFails(setDoc(doc(rectorA, 'colegios/A/sedes/sede2'), { nombre: 'Sede 2' }))
);

console.log('Colegio doc is read-only to clients (non-admin):');
await check(
  'rector cannot mutate colegio doc',
  assertFails(setDoc(doc(rectorA, 'colegios/A'), { nombre: 'hack' }, { merge: true }))
);

console.log('Account-scoped users/{uid}:');
await check('user reads own user doc', assertSucceeds(getDoc(doc(stuA1, 'users/uStuA1'))));
await check('user cannot read another user doc', assertFails(getDoc(doc(stuA2, 'users/uStuA1'))));
await check(
  'user creates own user doc (validated)',
  assertSucceeds(setDoc(doc(stuA1, 'users/uStuA1'), { displayName: 'A', provider: 'google' }))
);
await check(
  'wallet rejects negative total',
  assertFails(setDoc(doc(stuA1, 'users/uStuA1/wallet/state'), { totalCetis: -5 }))
);
await check(
  'wallet accepts valid total',
  assertSucceeds(setDoc(doc(stuA1, 'users/uStuA1/wallet/state'), { totalCetis: 10 }))
);

console.log('Content banks (bancos — shared global, read-only to clients):');
await check(
  'signed-in student reads bancos',
  assertSucceeds(getDoc(doc(stuA1, 'bancos/9_world_1_multiple_choice')))
);
await check(
  'signed-in staff reads bancos',
  assertSucceeds(getDoc(doc(profA1, 'bancos/9_world_1_multiple_choice')))
);
await check(
  'client cannot write bancos (Admin SDK only)',
  assertFails(
    setDoc(doc(stuA1, 'bancos/9_world_2_true_false'), {
      bancoId: '9_world_2_true_false',
      grado: '9',
      worldId: 'world_2',
      tipo: 'true_false',
      items: [],
    })
  )
);

console.log('Class leaderboard (V2 collaboration):');
const lbEntry = { uid: 'uLb1', displayLabel: 'lb1', xp: 50, updatedAt: 2 };
const lbPath = 'colegios/A/cursos/cLbOn/leaderboard/uLb1';
await check(
  'classmate reads leaderboard when colaboracionAula on',
  assertSucceeds(getDoc(doc(stuLb2, lbPath)))
);
await check(
  'classmate cannot read leaderboard when colaboracionAula off',
  assertFails(getDoc(doc(stuLb4, 'colegios/A/cursos/cLbOff/leaderboard/uLb3')))
);
await check('coordinador reads any course leaderboard', assertSucceeds(getDoc(doc(coordA, lbPath))));
await check(
  'student writes own leaderboard entry',
  assertSucceeds(setDoc(doc(stuLb1, lbPath), lbEntry))
);
await check(
  'student cannot write another student leaderboard entry',
  assertFails(setDoc(doc(stuLb2, lbPath), { ...lbEntry }))
);
await check(
  'leaderboard rejects negative xp',
  assertFails(setDoc(doc(stuLb1, lbPath), { ...lbEntry, xp: -1 }))
);

console.log('Demo cage (RQ-DM05 — demo admin confined to demo-colegio):');
await check(
  'demo admin reads own demo colegio',
  assertSucceeds(getDoc(doc(demoAdmin, 'colegios/demo-colegio')))
);
await check(
  'demo admin reads demo roster',
  assertSucceeds(getDoc(doc(demoAdmin, 'colegios/demo-colegio/cursos/dc1/estudiantes/demo-estudiante')))
);
await check(
  'demo admin CANNOT read a real colegio',
  assertFails(getDoc(doc(demoAdmin, 'colegios/A')))
);
await check(
  'demo admin CANNOT read a real colegio roster',
  assertFails(getDoc(doc(demoAdmin, 'colegios/A/cursos/c1/estudiantes/uStuA1')))
);
await check(
  'demo admin CANNOT create a real colegio',
  assertFails(setDoc(doc(demoAdmin, 'colegios/REAL'), { nombre: 'x', sedesEnabled: false, createdAt: 1 }))
);
await check(
  'demo admin CANNOT create a course in a real colegio',
  assertFails(
    setDoc(doc(demoAdmin, 'colegios/A/cursos/hack'), {
      nombre: 'h',
      grado: '9',
      profesorUids: [],
      colaboracionAula: false,
    })
  )
);
await check(
  'demo admin CAN create a course in the demo colegio',
  assertSucceeds(
    setDoc(doc(demoAdmin, 'colegios/demo-colegio/cursos/dcNew'), {
      nombre: 'Demo 10A',
      grado: '10',
      profesorUids: [],
      colaboracionAula: false,
    })
  )
);
await check(
  'demo admin collection-group on real colegio A denied',
  assertFails(cg(demoAdmin))
);

console.log('Default deny:');
await check('any other path denied', assertFails(getDoc(doc(stuA1, 'randomCol/randomDoc'))));

await env.cleanup();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
