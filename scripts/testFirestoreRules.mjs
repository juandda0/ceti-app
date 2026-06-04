/**
 * Firestore rules role-scenario tests (B2B2C multi-tenant).
 * Run via the emulator so FIRESTORE_EMULATOR_HOST is set:
 *   firebase emulators:exec --only firestore --project demo-ceti "node scripts/testFirestoreRules.mjs"
 *
 * Exits non-zero on any failed assertion. No jest — standalone to avoid the
 * jest-expo preset. Covers tenant isolation, role scope, the collection-group
 * report rule, and the student progress write guards.
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

// Auth contexts (second arg = custom claims).
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
  .authenticatedContext('uStuA1', { role: 'estudiante', colegioId: 'A', studentId: 's1' })
  .firestore();
const stuA2 = env
  .authenticatedContext('uStuA2', { role: 'estudiante', colegioId: 'A', studentId: 's2' })
  .firestore();
const stuA3 = env
  .authenticatedContext('uStuA3', { role: 'estudiante', colegioId: 'A', studentId: 's3' })
  .firestore();
const rectorB = env.authenticatedContext('uRectorB', { role: 'rector', colegioId: 'B' }).firestore();
const stuA4 = env
  .authenticatedContext('uStuA4', { role: 'estudiante', colegioId: 'A', studentId: 's4' })
  .firestore();
// Leaderboard (V2) contexts: students carry a cursoId claim.
const stuLb1 = env
  .authenticatedContext('uLb1', { role: 'estudiante', colegioId: 'A', studentId: 'lb1', cursoId: 'cLbOn' })
  .firestore();
const stuLb2 = env
  .authenticatedContext('uLb2', { role: 'estudiante', colegioId: 'A', studentId: 'lb2', cursoId: 'cLbOn' })
  .firestore();
const stuLb4 = env
  .authenticatedContext('uLb4', { role: 'estudiante', colegioId: 'A', studentId: 'lb4', cursoId: 'cLbOff' })
  .firestore();

const progPath = (cid, curso, sid, w) =>
  `colegios/${cid}/cursos/${curso}/estudiantes/${sid}/progress/${w}`;
const validProgress = {
  colegioId: 'A',
  cursoId: 'c1',
  studentId: 's1',
  competencia: 'ahorro',
  xp: 100,
  nivel: 2,
  mastery: 0.5,
  quizScores: { w1: 80 },
  badges: ['first'],
  completed: false,
  updatedAt: 1,
};

// Seed with rules disabled: course c1 (profesor uProfA1), roster s1, a progress doc.
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
  await setDoc(doc(db, 'colegios/A/cursos/c1/estudiantes/s1'), {
    displayLabel: 'Est 1',
    estado: 'activo',
    createdAt: 1,
  });
  // s3 exists but is NOT yet authorized (Ley 1581 gate).
  await setDoc(doc(db, 'colegios/A/cursos/c1/estudiantes/s3'), {
    displayLabel: 'Est 3',
    estado: 'pendiente_autorizacion',
    createdAt: 1,
  });
  await setDoc(doc(db, progPath('A', 'c1', 's1', 'w1')), validProgress);
  await setDoc(doc(db, 'membership/uStuA1'), { role: 'estudiante', colegioId: 'A', studentId: 's1' });
  // s4 is a suppressed (Ley 1581 erasure) roster slot — must not be able to write.
  await setDoc(doc(db, 'colegios/A/cursos/c1/estudiantes/s4'), {
    displayLabel: 'Est 4',
    estado: 'suprimido',
    createdAt: 1,
  });
  await setDoc(doc(db, 'colegios/A/sedes/sede1'), { nombre: 'Sede 1' });
  await setDoc(doc(db, 'colegios/A/autorizaciones/s1'), {
    estado: 'otorgada',
    politicaVersion: 'v1',
  });
  await setDoc(doc(db, 'classCodes/CODE1'), { colegioId: 'A', cursoId: 'c1' });
  await setDoc(doc(db, 'questionBank/q1'), { worldId: 'world_1', competencia: 'ahorro' });
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
  for (const [curso, sid] of [
    ['cLbOn', 'lb1'],
    ['cLbOn', 'lb2'],
    ['cLbOff', 'lb3'],
    ['cLbOff', 'lb4'],
  ]) {
    await setDoc(doc(db, `colegios/A/cursos/${curso}/estudiantes/${sid}`), {
      displayLabel: sid,
      estado: 'activo',
      createdAt: 1,
    });
  }
  await setDoc(doc(db, 'colegios/A/cursos/cLbOn/leaderboard/lb1'), {
    studentId: 'lb1',
    displayLabel: 'lb1',
    xp: 100,
    updatedAt: 1,
  });
  await setDoc(doc(db, 'colegios/A/cursos/cLbOff/leaderboard/lb3'), {
    studentId: 'lb3',
    displayLabel: 'lb3',
    xp: 100,
    updatedAt: 1,
  });
});

console.log('Tenant isolation:');
await check('rector A reads own colegio', assertSucceeds(getDoc(doc(rectorA, 'colegios/A'))));
await check('student A reads own colegio (cert)', assertSucceeds(getDoc(doc(stuA1, 'colegios/A'))));
await check('rector B cannot read colegio A', assertFails(getDoc(doc(rectorB, 'colegios/A'))));

console.log('Student progress read:');
await check('student reads own progress', assertSucceeds(getDoc(doc(stuA1, progPath('A', 'c1', 's1', 'w1')))));
await check(
  'student cannot read another student progress',
  assertFails(getDoc(doc(stuA2, progPath('A', 'c1', 's1', 'w1'))))
);

console.log('Teacher scope (nested rule):');
await check(
  'teacher of course reads student progress',
  assertSucceeds(getDoc(doc(profA1, progPath('A', 'c1', 's1', 'w1'))))
);
await check(
  'teacher NOT of course cannot read it directly',
  assertFails(getDoc(doc(profA2, progPath('A', 'c1', 's1', 'w1'))))
);

console.log('Collection-group report rule:');
const cg = (db) => getDocs(query(collectionGroup(db, 'progress'), where('colegioId', '==', 'A')));
await check('coordinador collection-group read', assertSucceeds(cg(coordA)));
await check('rector collection-group read', assertSucceeds(cg(rectorA)));
await check('profesor collection-group read denied', assertFails(cg(profA1)));
await check('rector B collection-group on A denied', assertFails(cg(rectorB)));

console.log('Student progress write guards:');
await check(
  'student writes valid own progress',
  assertSucceeds(setDoc(doc(stuA1, progPath('A', 'c1', 's1', 'w2')), { ...validProgress }))
);
await check(
  'mastery > 1 rejected',
  assertFails(setDoc(doc(stuA1, progPath('A', 'c1', 's1', 'w3')), { ...validProgress, mastery: 5 }))
);
await check(
  'spoofed studentId rejected',
  assertFails(setDoc(doc(stuA1, progPath('A', 'c1', 's1', 'w4')), { ...validProgress, studentId: 's2' }))
);
await check(
  'write into non-existent roster slot rejected',
  assertFails(setDoc(doc(stuA2, progPath('A', 'c1', 's2', 'w1')), { ...validProgress, studentId: 's2' }))
);
await check(
  'Ley 1581: unauthorized (pendiente) student cannot write progress',
  assertFails(
    setDoc(doc(stuA3, progPath('A', 'c1', 's3', 'w1')), {
      ...validProgress,
      studentId: 's3',
    })
  )
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
  'rector can change profesorUids',
  assertSucceeds(
    setDoc(doc(rectorA, 'colegios/A/cursos/c1'), { profesorUids: ['uProfA1', 'uProfA2'] }, { merge: true })
  )
);

console.log('Assignments:');
const asigPath = 'colegios/A/asignaciones/a1';
const asig = { worldId: 'world_1', target: { tipo: 'curso', cursoId: 'c1' }, fechaInicio: 1, deadline: 2, createdByUid: 'uProfA1', createdAt: 1 };
await check('teacher creates assignment', assertSucceeds(setDoc(doc(profA1, asigPath), asig)));
await check('student reads assignment', assertSucceeds(getDoc(doc(stuA1, asigPath))));
await check(
  'student cannot create assignment',
  assertFails(setDoc(doc(stuA2, 'colegios/A/asignaciones/a2'), asig))
);
await check('rector B cannot read A assignment', assertFails(getDoc(doc(rectorB, asigPath))));

console.log('Membership & questionBank:');
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

console.log('Autorizaciones (Ley 1581 register; Function-only writes):');
await check(
  'staff reads autorizaciones',
  assertSucceeds(getDoc(doc(profA1, 'colegios/A/autorizaciones/s1')))
);
await check(
  'student cannot read autorizaciones',
  assertFails(getDoc(doc(stuA1, 'colegios/A/autorizaciones/s1')))
);
await check(
  'rector B cannot read A autorizaciones',
  assertFails(getDoc(doc(rectorB, 'colegios/A/autorizaciones/s1')))
);
await check(
  'even rector cannot write autorizaciones (Function only)',
  assertFails(
    setDoc(doc(rectorA, 'colegios/A/autorizaciones/s9'), { estado: 'otorgada', politicaVersion: 'v1' })
  )
);

console.log('Sedes:');
await check('staff reads sede', assertSucceeds(getDoc(doc(profA1, 'colegios/A/sedes/sede1'))));
await check('student cannot read sede', assertFails(getDoc(doc(stuA1, 'colegios/A/sedes/sede1'))));
await check(
  'client cannot write sede',
  assertFails(setDoc(doc(rectorA, 'colegios/A/sedes/sede2'), { nombre: 'Sede 2' }))
);

console.log('Colegio doc is read-only to clients:');
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
await check('aiProfile self read ok', assertSucceeds(getDoc(doc(stuA1, 'users/uStuA1/aiProfile/state'))));
await check(
  'aiProfile client write denied (no AI in MVP)',
  assertFails(setDoc(doc(stuA1, 'users/uStuA1/aiProfile/state'), { weakness: 'x' }))
);

console.log('Question bank (read-only):');
await check('signed-in reads questionBank', assertSucceeds(getDoc(doc(stuA1, 'questionBank/q1'))));
await check(
  'client cannot write questionBank',
  assertFails(setDoc(doc(stuA1, 'questionBank/q2'), { worldId: 'world_1' }))
);

console.log('Suppression & delete guards:');
await check(
  'Ley 1581: suprimido student cannot write progress',
  assertFails(setDoc(doc(stuA4, progPath('A', 'c1', 's4', 'w1')), { ...validProgress, studentId: 's4' }))
);
await check(
  'progress cannot be deleted by the student',
  assertFails(deleteDoc(doc(stuA1, progPath('A', 'c1', 's1', 'w1'))))
);

console.log('Class leaderboard (V2 collaboration):');
const lbEntry = { studentId: 'lb1', displayLabel: 'lb1', xp: 50, updatedAt: 2 };
const lbPath = 'colegios/A/cursos/cLbOn/leaderboard/lb1';
await check(
  'classmate reads leaderboard when colaboracionAula on',
  assertSucceeds(getDoc(doc(stuLb2, lbPath)))
);
await check(
  'classmate cannot read leaderboard when colaboracionAula off',
  assertFails(getDoc(doc(stuLb4, 'colegios/A/cursos/cLbOff/leaderboard/lb3')))
);
await check('rector reads any course leaderboard', assertSucceeds(getDoc(doc(rectorA, lbPath))));
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

await env.cleanup();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
