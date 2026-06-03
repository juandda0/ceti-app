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
});

console.log('Tenant isolation:');
await check('rector A reads own colegio', assertSucceeds(getDoc(doc(rectorA, 'colegios/A'))));
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

await env.cleanup();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
