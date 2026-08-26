/**
 * Firestore rules role-scenario tests (B2B2C multi-tenant — D-PIVOT).
 * Run via the emulator so FIRESTORE_EMULATOR_HOST is set:
 *   firebase emulators:exec --only firestore --project demo-ceti "node scripts/testFirestoreRules.mjs"
 *
 * Exits non-zero on any failed assertion. Standalone (no jest). Covers the §1.3
 * matrix after the pivot: only two app roles (profesor + estudiante); `admin` is
 * a BACKEND-ONLY claim, so its token gets NOTHING from these client rules
 * (structure provisioning goes through the Admin SDK, which bypasses rules).
 * Tenant isolation, uid-identity (R1), the Ley 1581 attestation gate, the
 * collection-group report rule, aggregates (profesor), and progress write
 * guards. At least one allow + one deny per critical cell.
 */
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  collection,
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
// admin is a backend-only claim: its token must get NOTHING from client rules.
const adminG = env.authenticatedContext('uAdmin', { role: 'admin' }).firestore();
const profA1 = env
  .authenticatedContext('uProfA1', { role: 'profesor', colegioId: 'A' })
  .firestore();
const profA2 = env
  .authenticatedContext('uProfA2', { role: 'profesor', colegioId: 'A' })
  .firestore();
const profB = env
  .authenticatedContext('uProfB', { role: 'profesor', colegioId: 'B' })
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
const stuMoved = env
  .authenticatedContext('uStuA1', { role: 'estudiante', colegioId: 'B', cursoId: 'cB1' })
  .firestore();
const stuMovedCourse = env
  .authenticatedContext('uStuA1', { role: 'estudiante', colegioId: 'A', cursoId: 'c2' })
  .firestore();
const progPath = (cid, curso, uid, w) =>
  `colegios/${cid}/cursos/${curso}/estudiantes/${uid}/progress/${w}`;
const validProgress = {
  colegioId: 'A',
  cursoId: 'c1',
  uid: 'uStuA1',
  competencia: 'ahorro',
  mastery: 0.5,
  quizScores: { w1: 80 },
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
  });
  await setDoc(doc(db, 'colegios/A/cursos/c2'), {
    nombre: '9B',
    grado: '9',
    profesorUids: ['uProfA2'],
    codigo: 'SECRE2',
  });
  await setDoc(doc(db, 'colegios/A/asignaciones/aCurso2'), {
    worldId: 'world_1',
    target: { tipo: 'curso', cursoId: 'c2' },
    fechaInicio: 1,
    deadline: 2,
    createdByUid: 'uProfA2',
    createdAt: 1,
  });
  await setDoc(doc(db, 'colegios/A/asignaciones/aStu1'), {
    worldId: 'world_1',
    target: { tipo: 'estudiante', cursoId: 'c1', uid: 'uStuA1' },
    fechaInicio: 1,
    deadline: 2,
    createdByUid: 'uProfA1',
    createdAt: 1,
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
  // EligeCamino shared content (R8): doc id is `${grado}_${worldId}`.
  await setDoc(doc(db, 'bancosEligeCamino/9_world_1'), {
    bancoId: '9_world_1',
    grado: '9',
    worldId: 'world_1',
    situaciones: [],
    pendiente_validacion_docente: true,
  });
  // Micro-teoría shared content (R8): doc id is `${grado}_${worldId}`.
  await setDoc(doc(db, 'microteoria/9_world_1'), {
    grado: '9',
    worldId: 'world_1',
    cards: [],
    generadoPor: 'ia',
    pendiente_validacion_docente: true,
  });
});

console.log('Tenant isolation:');
await check('profesor A reads own colegio', assertSucceeds(getDoc(doc(profA1, 'colegios/A'))));
await check('student A reads own colegio', assertSucceeds(getDoc(doc(stuA1, 'colegios/A'))));
await check('profesor B cannot read colegio A', assertFails(getDoc(doc(profB, 'colegios/A'))));
await check(
  'admin token gets NOTHING from client rules (backend-only)',
  assertFails(getDoc(doc(adminG, 'colegios/A')))
);

console.log('Structure provisioning is Admin SDK only (client denied):');
await check(
  'admin token cannot create a colegio from the client',
  assertFails(setDoc(doc(adminG, 'colegios/X'), { nombre: 'X', sedesEnabled: false, createdAt: 1 }))
);
await check(
  'profesor cannot create a curso (structure = backend)',
  assertFails(
    setDoc(doc(profA1, 'colegios/A/cursos/cNew'), {
      nombre: 'cNew',
      grado: '9',
      profesorUids: [],
    })
  )
);

console.log('Roster nominal read (teacher of course + self only):');
await check(
  'teacher of course reads roster',
  assertSucceeds(getDoc(doc(profA1, 'colegios/A/cursos/c1/estudiantes/uStuA1')))
);
await check(
  'teacher NOT of course cannot read roster',
  assertFails(getDoc(doc(profA2, 'colegios/A/cursos/c1/estudiantes/uStuA1')))
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
  'moved student cannot read old roster slot',
  assertFails(getDoc(doc(stuMoved, 'colegios/A/cursos/c1/estudiantes/uStuA1')))
);
await check(
  'student moved within colegio cannot read old roster slot',
  assertFails(getDoc(doc(stuMovedCourse, 'colegios/A/cursos/c1/estudiantes/uStuA1')))
);
await check(
  'roster is Function-only: profesor cannot client-write it',
  assertFails(
    setDoc(
      doc(profA1, 'colegios/A/cursos/c1/estudiantes/uStuA1'),
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
  'moved student cannot read old progress',
  assertFails(getDoc(doc(stuMoved, progPath('A', 'c1', 'uStuA1', 'w1'))))
);
await check(
  'student moved within colegio cannot read old progress',
  assertFails(getDoc(doc(stuMovedCourse, progPath('A', 'c1', 'uStuA1', 'w1'))))
);
await check(
  'teacher of course reads student progress',
  assertSucceeds(getDoc(doc(profA1, progPath('A', 'c1', 'uStuA1', 'w1'))))
);
// The real consumer (loadCourseReport → getStudentProgress) does a LIST over the
// progress subcollection, not a single getDoc — cover that path explicitly.
await check(
  'teacher of course list-reads the progress subcollection',
  assertSucceeds(
    getDocs(collection(profA1, 'colegios/A/cursos/c1/estudiantes/uStuA1/progress'))
  )
);
await check(
  'teacher NOT of course cannot read it directly',
  assertFails(getDoc(doc(profA2, progPath('A', 'c1', 'uStuA1', 'w1'))))
);

console.log('Collection-group progress reads are removed post-pivot (all denied):');
// The profesor reads per-course progress via direct nested reads (tested above)
// and colegio-wide compliance via agregados/*. No collection-group progress rule
// exists, so every such query default-denies — including the course teacher's.
const cg = (db) => getDocs(query(collectionGroup(db, 'progress'), where('colegioId', '==', 'A')));
await check('teacher of course collection-group DENIED (uses per-course reads)', assertFails(cg(profA1)));
await check('profesor not-of-course collection-group denied', assertFails(cg(profA2)));
await check('admin token collection-group denied (backend-only)', assertFails(cg(adminG)));
await check('profesor B collection-group on A denied', assertFails(cg(profB)));

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
await check(
  'moved student cannot read old impact test',
  assertFails(getDoc(doc(stuMoved, impactPath('uStuA1', 'pre'))))
);
await check(
  'student moved within colegio cannot read old impact test',
  assertFails(getDoc(doc(stuMovedCourse, impactPath('uStuA1', 'pre'))))
);

console.log('Aggregates (profesor ALLOWED colegio-wide, students denied):');
await check(
  'profesor reads aggregates of own course',
  assertSucceeds(getDoc(doc(profA1, 'colegios/A/cursos/c1/agregados/ag1')))
);
// LOAD-BEARING: the school report (loadSchoolReport) iterates EVERY course and
// reads agregados/resumen — so a profesor must read aggregates of a course they
// do NOT teach (institutional reporting moved to profesor, D-PIVOT). profA2
// teaches no course; asserting this pins the colegio-wide capability so tightening
// the rule back to isProfesorDe would fail here instead of silently breaking the report.
await check(
  'profesor reads aggregates of a course they do NOT teach (colegio-wide report)',
  assertSucceeds(getDoc(doc(profA2, 'colegios/A/cursos/c1/agregados/ag1')))
);
await check(
  'student cannot read aggregates',
  assertFails(getDoc(doc(stuA1, 'colegios/A/cursos/c1/agregados/ag1')))
);
await check(
  'client cannot write aggregates (Function only)',
  assertFails(setDoc(doc(profA1, 'colegios/A/cursos/c1/agregados/ag2'), { updatedAt: 1 }))
);

console.log('Course update denied (structure/settings = backend):');
await check(
  'student reads own course doc',
  assertSucceeds(getDoc(doc(stuA1, 'colegios/A/cursos/c1')))
);
await check(
  'student cannot read another course doc or its code',
  assertFails(getDoc(doc(stuA1, 'colegios/A/cursos/c2')))
);
await check(
  'course teacher reads own course doc',
  assertSucceeds(getDoc(doc(profA1, 'colegios/A/cursos/c1')))
);
await check(
  'teacher cannot read a course they do not teach',
  assertFails(getDoc(doc(profA1, 'colegios/A/cursos/c2')))
);
await check(
  'teacher cannot update course doc (structure = backend)',
  assertFails(
    setDoc(doc(profA1, 'colegios/A/cursos/c1'), { profesorUids: ['uProfA1', 'uProfA2'] }, { merge: true })
  )
);

console.log('Assignments:');
const asigPath = 'colegios/A/asignaciones/a1';
const asig = { worldId: 'world_1', target: { tipo: 'curso', cursoId: 'c1' }, fechaInicio: 1, deadline: 2, createdByUid: 'uProfA1', createdAt: 1 };
await check('teacher of course creates assignment', assertSucceeds(setDoc(doc(profA1, asigPath), asig)));
await check(
  'teacher NOT of course cannot create assignment',
  assertFails(setDoc(doc(profA2, 'colegios/A/asignaciones/aX'), asig))
);
await check('student reads assignment', assertSucceeds(getDoc(doc(stuA1, asigPath))));
await check(
  'student cannot create assignment',
  assertFails(setDoc(doc(stuA2, 'colegios/A/asignaciones/a2'), asig))
);
await check('profesor B cannot read A assignment', assertFails(getDoc(doc(profB, asigPath))));
await check(
  'student cannot read another course assignment',
  assertFails(getDoc(doc(stuA1, 'colegios/A/asignaciones/aCurso2')))
);
await check(
  'target student reads individual assignment',
  assertSucceeds(getDoc(doc(stuA1, 'colegios/A/asignaciones/aStu1')))
);
await check(
  'other student cannot read individual assignment',
  assertFails(getDoc(doc(stuA2, 'colegios/A/asignaciones/aStu1')))
);
await check(
  'teacher cannot read another course assignment',
  assertFails(getDoc(doc(profA1, 'colegios/A/asignaciones/aCurso2')))
);
await check(
  'teacher cannot retarget assignment',
  assertFails(
    setDoc(
      doc(profA1, asigPath),
      { target: { tipo: 'curso', cursoId: 'c2' } },
      { merge: true }
    )
  )
);
await check(
  'teacher cannot replace creator',
  assertFails(setDoc(doc(profA1, asigPath), { createdByUid: 'uProfA2' }, { merge: true }))
);

console.log('Membership:');
await check('user reads own membership', assertSucceeds(getDoc(doc(stuA1, 'membership/uStuA1'))));
await check('user cannot read other membership', assertFails(getDoc(doc(stuA2, 'membership/uStuA1'))));
await check(
  'client cannot write membership',
  assertFails(setDoc(doc(stuA1, 'membership/uStuA1'), { role: 'profesor', colegioId: 'A' }))
);

console.log('Class codes (deny-all to clients):');
await check('client cannot read classCodes', assertFails(getDoc(doc(stuA1, 'classCodes/CODE1'))));
await check(
  'client cannot write classCodes',
  assertFails(setDoc(doc(stuA1, 'classCodes/NEW'), { colegioId: 'A', cursoId: 'c1' }))
);

console.log('Sedes (dormant):');
await check('profesor reads sede', assertSucceeds(getDoc(doc(profA1, 'colegios/A/sedes/sede1'))));
await check('student cannot read sede', assertFails(getDoc(doc(stuA1, 'colegios/A/sedes/sede1'))));
await check(
  'client cannot write sede',
  assertFails(setDoc(doc(profA1, 'colegios/A/sedes/sede2'), { nombre: 'Sede 2' }))
);

console.log('Colegio doc is read-only to clients:');
await check(
  'profesor cannot mutate colegio doc',
  assertFails(setDoc(doc(profA1, 'colegios/A'), { nombre: 'hack' }, { merge: true }))
);

console.log('Account-scoped users/{uid}:');
await check('user reads own user doc', assertSucceeds(getDoc(doc(stuA1, 'users/uStuA1'))));
await check('user cannot read another user doc', assertFails(getDoc(doc(stuA2, 'users/uStuA1'))));
await check(
  'user creates own user doc (validated)',
  assertSucceeds(setDoc(doc(stuA1, 'users/uStuA1'), { displayName: 'A', provider: 'google' }))
);

console.log('Savings goals and operations (RQ-ES11):');
const validGoal = {
  id: 'g1',
  title: 'Computador',
  iconId: 'laptop',
  category: 'electronics',
  targetAmount: 1000000,
  createdAt: 1,
  updatedAt: 1,
};
await check(
  'student creates a validated goal',
  assertSucceeds(setDoc(doc(stuA1, 'users/uStuA1/goals/g1'), validGoal))
);
await check(
  'goal rejects legacy emoji and stored balance',
  assertFails(setDoc(doc(stuA1, 'users/uStuA1/goals/g2'), { ...validGoal, id: 'g2', emoji: 'x', currentAmount: 1 }))
);
await check(
  'goal rejects changing immutable creation time',
  assertFails(setDoc(doc(stuA1, 'users/uStuA1/goals/g1'), { ...validGoal, createdAt: 2 }))
);
await check(
  'goal is soft-deleted, not hard-deleted',
  assertFails(deleteDoc(doc(stuA1, 'users/uStuA1/goals/g1')))
);
const validOperation = {
  id: 'op1',
  type: 'aporte',
  amount: 50000,
  description: 'Ahorro semanal',
  goalId: 'g1',
  fecha: 1,
  createdAt: 1,
  updatedAt: 1,
};
await check(
  'student creates a validated savings operation',
  assertSucceeds(setDoc(doc(stuA1, 'users/uStuA1/deposits/op1'), validOperation))
);
await check(
  'operation rejects negative money',
  assertFails(setDoc(doc(stuA1, 'users/uStuA1/deposits/op2'), { ...validOperation, id: 'op2', amount: -1 }))
);
await check(
  'operation type is immutable',
  assertFails(setDoc(doc(stuA1, 'users/uStuA1/deposits/op1'), { ...validOperation, type: 'retiro' }))
);
await check(
  'another student cannot read savings operations',
  assertFails(getDoc(doc(stuA2, 'users/uStuA1/deposits/op1')))
);

console.log('Pocket-money diary users/{uid}/movimientos (RQ-ES10):');
const validMovimiento = {
  id: 'm1',
  tipo: 'gasto',
  monto: 5000,
  descripcion: 'helado',
  categoria: 'comida',
  origen: 'voz',
  fecha: 1,
  createdAt: 1,
  updatedAt: 1,
};
await check(
  'student creates own valid movimiento',
  assertSucceeds(setDoc(doc(stuA1, 'users/uStuA1/movimientos/m1'), validMovimiento))
);
await check(
  'student deletes own movimiento',
  assertSucceeds(deleteDoc(doc(stuA1, 'users/uStuA1/movimientos/m1')))
);
await check(
  'movimiento rejects negative monto',
  assertFails(setDoc(doc(stuA1, 'users/uStuA1/movimientos/m2'), { ...validMovimiento, monto: -100 }))
);
await check(
  'movimiento rejects string monto',
  assertFails(setDoc(doc(stuA1, 'users/uStuA1/movimientos/m2'), { ...validMovimiento, monto: '5000' }))
);
await check(
  'movimiento rejects invalid tipo',
  assertFails(setDoc(doc(stuA1, 'users/uStuA1/movimientos/m2'), { ...validMovimiento, tipo: 'prestamo' }))
);
await check(
  'movimiento rejects invalid categoria',
  assertFails(
    setDoc(doc(stuA1, 'users/uStuA1/movimientos/m2'), { ...validMovimiento, categoria: 'apuestas' })
  )
);
await check(
  'movimiento rejects long descripcion',
  assertFails(
    setDoc(doc(stuA1, 'users/uStuA1/movimientos/m2'), {
      ...validMovimiento,
      descripcion: 'x'.repeat(200),
    })
  )
);
await check(
  'movimiento rejects invalid origen',
  assertFails(setDoc(doc(stuA1, 'users/uStuA1/movimientos/m2'), { ...validMovimiento, origen: 'api' }))
);
await check(
  'movimiento rejects monto over cap',
  assertFails(
    setDoc(doc(stuA1, 'users/uStuA1/movimientos/m2'), { ...validMovimiento, monto: 100000001 })
  )
);
await check(
  'movimiento rejects unknown extra field (hasOnly)',
  assertFails(
    setDoc(doc(stuA1, 'users/uStuA1/movimientos/m2'), { ...validMovimiento, hacker: true })
  )
);
await check(
  'movimiento rejects savings entries (separate ledger)',
  assertFails(setDoc(doc(stuA1, 'users/uStuA1/movimientos/m3'), { ...validMovimiento, id: 'm3', tipo: 'ahorro' }))
);
// Solo-vista-propia (CA5): ni otro estudiante, ni profesor, ni admin leen
// movimientos individuales.
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'users/uStuA1/movimientos/mSeed'), { ...validMovimiento, id: 'mSeed' });
});
await check(
  'another student cannot read movimientos',
  assertFails(getDoc(doc(stuA2, 'users/uStuA1/movimientos/mSeed')))
);
await check(
  'profesor cannot read movimientos',
  assertFails(getDoc(doc(profA1, 'users/uStuA1/movimientos/mSeed')))
);
await check(
  'admin cannot read movimientos (self-only)',
  assertFails(getDoc(doc(adminG, 'users/uStuA1/movimientos/mSeed')))
);
await check(
  'another student cannot write movimientos',
  assertFails(setDoc(doc(stuA2, 'users/uStuA1/movimientos/mSeed'), validMovimiento))
);
await check(
  'admin cannot delete movimientos (self-only)',
  assertFails(deleteDoc(doc(adminG, 'users/uStuA1/movimientos/mSeed')))
);
await check(
  'collection-group query over movimientos denied',
  assertFails(getDocs(query(collectionGroup(profA1, 'movimientos'), where('tipo', '==', 'gasto'))))
);
await check(
  'merge update cannot smuggle invalid monto',
  assertFails(
    setDoc(doc(stuA1, 'users/uStuA1/movimientos/mSeed'), { monto: -1 }, { merge: true })
  )
);
await check(
  'merge update with valid monto passes',
  assertSucceeds(
    setDoc(doc(stuA1, 'users/uStuA1/movimientos/mSeed'), { monto: 7000 }, { merge: true })
  )
);
// vozUso/* (cap diario, RQ-ES10 CA8): solo Admin SDK — default deny para clientes.
await check(
  'client cannot read vozUso',
  assertFails(getDoc(doc(stuA1, 'vozUso/uStuA1_2026-07-08')))
);
await check(
  'client cannot write vozUso',
  assertFails(setDoc(doc(stuA1, 'vozUso/uStuA1_2026-07-08'), { count: 0 }))
);
console.log('Content banks (bancos — shared global, read-only to clients):');
await check(
  'signed-in student reads bancos',
  assertSucceeds(getDoc(doc(stuA1, 'bancos/9_world_1_multiple_choice')))
);
await check(
  'signed-in profesor reads bancos',
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

console.log('EligeCamino + micro-teoría (shared global content, read-only to clients):');
await check(
  'signed-in student reads bancosEligeCamino',
  assertSucceeds(getDoc(doc(stuA1, 'bancosEligeCamino/9_world_1')))
);
await check(
  'signed-in profesor reads bancosEligeCamino',
  assertSucceeds(getDoc(doc(profA1, 'bancosEligeCamino/9_world_1')))
);
await check(
  'client cannot write bancosEligeCamino (Admin SDK only)',
  assertFails(
    setDoc(doc(stuA1, 'bancosEligeCamino/9_world_2'), {
      bancoId: '9_world_2',
      grado: '9',
      worldId: 'world_2',
      situaciones: [],
    })
  )
);
await check(
  'signed-in student reads microteoria',
  assertSucceeds(getDoc(doc(stuA1, 'microteoria/9_world_1')))
);
await check(
  'signed-in profesor reads microteoria',
  assertSucceeds(getDoc(doc(profA1, 'microteoria/9_world_1')))
);
await check(
  'client cannot write microteoria (Admin SDK only)',
  assertFails(
    setDoc(doc(stuA1, 'microteoria/9_world_2'), {
      grado: '9',
      worldId: 'world_2',
      cards: [],
    })
  )
);

console.log('Class config cursos/{cursoId}/config/mundos (D-ORQ, RQ-PR10):');
const configPath = 'colegios/A/cursos/c1/config/mundos';
const validConfig = {
  mundos: [
    { worldId: 'world_3', activo: true },
    { worldId: 'world_1', activo: true },
    { worldId: 'world_2', activo: false },
    { worldId: 'world_4', activo: true },
    { worldId: 'world_5', activo: true },
  ],
  version: 1,
  updatedAt: 1,
  updatedByUid: 'uProfA1',
};
// A second-course student in colegio A must NOT read c1's config.
const stuAC2 = env
  .authenticatedContext('uStuAC2', { role: 'estudiante', colegioId: 'A', cursoId: 'c2' })
  .firestore();
await check(
  'course teacher writes class config',
  assertSucceeds(setDoc(doc(profA1, configPath), validConfig))
);
await check(
  'other teacher of same colegio cannot write class config',
  assertFails(setDoc(doc(profA2, configPath), { ...validConfig, updatedByUid: 'uProfA2' }))
);
await check(
  'teacher of colegio B cannot read class config',
  assertFails(getDoc(doc(profB, configPath)))
);
await check(
  'student of the course reads class config (live)',
  assertSucceeds(getDoc(doc(stuA1, configPath)))
);
await check(
  'student of ANOTHER course cannot read class config',
  assertFails(getDoc(doc(stuAC2, configPath)))
);
await check(
  'student cannot write class config',
  assertFails(setDoc(doc(stuA1, configPath), { ...validConfig, updatedByUid: 'uStuA1' }))
);
await check(
  'config rejects unexpected fields (hasOnly)',
  assertFails(setDoc(doc(profA1, configPath), { ...validConfig, extra: true }))
);
await check(
  'config rejects empty mundos list',
  assertFails(setDoc(doc(profA1, configPath), { ...validConfig, mundos: [] }))
);
await check(
  'config rejects spoofed updatedByUid',
  assertFails(setDoc(doc(profA1, configPath), { ...validConfig, updatedByUid: 'uProfA2' }))
);
await check(
  'config doc id other than "mundos" cannot be written',
  assertFails(setDoc(doc(profA1, 'colegios/A/cursos/c1/config/otra'), validConfig))
);
await check(
  'admin token gets nothing from client rules (config write denied)',
  assertFails(setDoc(doc(adminG, configPath), { ...validConfig, updatedByUid: 'uAdmin' }))
);
await check(
  'course teacher deletes class config (restaurar defaults)',
  assertSucceeds(deleteDoc(doc(profA1, configPath)))
);
await check(
  'student cannot delete class config',
  assertFails(deleteDoc(doc(stuA1, configPath)))
);

// Hardening (auditoría A): write-deny cross-colegio, estudiante cross-colegio,
// collection-group y bounds negativos.
const stuB = env
  .authenticatedContext('uStuB', { role: 'estudiante', colegioId: 'B', cursoId: 'cB1' })
  .firestore();
await check(
  'teacher of colegio B cannot write class config',
  assertFails(setDoc(doc(profB, configPath), { ...validConfig, updatedByUid: 'uProfB' }))
);
await check(
  'student of colegio B cannot read class config',
  assertFails(getDoc(doc(stuB, configPath)))
);
await check(
  'config rejects >30 mundos',
  assertFails(
    setDoc(doc(profA1, configPath), {
      ...validConfig,
      mundos: Array.from({ length: 31 }, (_, i) => ({ worldId: `w${i}`, activo: true })),
    })
  )
);
await check(
  'config rejects unknown field (modoEnfocado removido)',
  assertFails(setDoc(doc(profA1, configPath), { ...validConfig, modoEnfocado: { activo: false } }))
);
await check(
  'collectionGroup(config) denied',
  assertFails(getDocs(query(collectionGroup(profA1, 'config'))))
);

console.log('Course custom content cursos/{cursoId}/contenido (D-ORQ, RQ-PR11):');
const contPath = (docId) => `colegios/A/cursos/c1/contenido/${docId}`;
const customBanco = {
  bancoId: 'banco_world_1_multiple_choice',
  grado: '9',
  worldId: 'world_1',
  tipo: 'multiple_choice',
  version: 2,
  generadoPor: 'profesor',
  pendiente_validacion_docente: false,
  items: [
    { id: 'q1', enunciado: '¿Qué es el ingreso?', competencia: 'ingreso', dificultad: 1, opciones: ['a', 'b', 'c', 'd'], correctIndex: 0 },
  ],
};
await check(
  'course teacher writes custom banco copy',
  assertSucceeds(setDoc(doc(profA1, contPath('banco_world_1_multiple_choice')), customBanco))
);
await check(
  'course teacher writes custom microteoria',
  assertSucceeds(
    setDoc(doc(profA1, contPath('microteoria_world_1')), {
      grado: '9',
      worldId: 'world_1',
      cards: [{ titulo: 'Ingreso', cuerpo: 'Qué es.' }],
      generadoPor: 'profesor',
      pendiente_validacion_docente: false,
    })
  )
);
await check(
  'other teacher of same colegio cannot write custom content',
  assertFails(setDoc(doc(profA2, contPath('banco_world_1_true_false')), customBanco))
);
await check(
  'teacher of colegio B cannot write custom content',
  assertFails(setDoc(doc(profB, contPath('banco_world_1_true_false')), customBanco))
);
await check(
  'student of the course reads custom content',
  assertSucceeds(getDoc(doc(stuA1, contPath('banco_world_1_multiple_choice'))))
);
await check(
  'student of ANOTHER course cannot read custom content',
  assertFails(getDoc(doc(stuAC2, contPath('banco_world_1_multiple_choice'))))
);
await check(
  'student cannot write custom content',
  assertFails(setDoc(doc(stuA1, contPath('banco_world_1_multiple_choice')), customBanco))
);
await check(
  'contenido rejects unknown doc-id shape',
  assertFails(setDoc(doc(profA1, contPath('otraCosa_world_1')), customBanco))
);
await check(
  'contenido banco rejects empty items',
  assertFails(
    setDoc(doc(profA1, contPath('banco_world_1_ordenar')), { ...customBanco, items: [] })
  )
);
await check(
  'contenido banco rejects missing items list',
  assertFails(
    setDoc(doc(profA1, contPath('banco_world_1_ordenar')), { bancoId: 'x', tipo: 'ordenar' })
  )
);
await check(
  'course teacher deletes custom content (restaurar default)',
  assertSucceeds(deleteDoc(doc(profA1, contPath('banco_world_1_multiple_choice'))))
);
await check(
  'student cannot delete custom content',
  assertFails(deleteDoc(doc(stuA1, contPath('microteoria_world_1'))))
);
await check(
  'config accepts overrides field (RQ-PR11 flags)',
  assertSucceeds(
    setDoc(doc(profA1, configPath), {
      ...validConfig,
      overrides: { world_1: { mc: true, teoria: true } },
    })
  )
);
await check(
  'config rejects non-map overrides',
  assertFails(setDoc(doc(profA1, configPath), { ...validConfig, overrides: 'todo' }))
);
await check(
  'course teacher writes custom eligeCamino',
  assertSucceeds(
    setDoc(doc(profA1, contPath('eligeCamino_world_1')), {
      bancoId: 'eligeCamino_world_1',
      grado: '9',
      worldId: 'world_1',
      situaciones: [{ id: 's1', enunciado: 'x', opcionA: {}, opcionB: {} }],
      generadoPor: 'profesor',
      pendiente_validacion_docente: false,
    })
  )
);
await check(
  'contenido banco rejects unexpected fields (hasOnly)',
  assertFails(
    setDoc(doc(profA1, contPath('banco_world_1_true_false')), { ...customBanco, extra: 1 })
  )
);
await check(
  'contenido banco rejects >100 items',
  assertFails(
    setDoc(doc(profA1, contPath('banco_world_1_true_false')), {
      ...customBanco,
      items: Array.from({ length: 101 }, (_, i) => ({ id: `q${i}` })),
    })
  )
);
await check(
  'collectionGroup(contenido) denied',
  assertFails(getDocs(query(collectionGroup(profA1, 'contenido'))))
);

console.log('Professor authorizations profesoresAutorizados (D-ADMIN):');
await check(
  'admin reads profesoresAutorizados',
  assertSucceeds(getDoc(doc(adminG, 'profesoresAutorizados/prof_at_x')))
);
await check(
  'profesor cannot read profesoresAutorizados',
  assertFails(getDoc(doc(profA1, 'profesoresAutorizados/prof_at_x')))
);
await check(
  'student cannot read profesoresAutorizados',
  assertFails(getDoc(doc(stuA1, 'profesoresAutorizados/prof_at_x')))
);
await check(
  'admin cannot write profesoresAutorizados (Function only)',
  assertFails(
    setDoc(doc(adminG, 'profesoresAutorizados/prof_at_x'), { email: 'p@x', colegioId: 'A' })
  )
);

// ---- RQ-ES11 presupuestos (self-only) + RQ-PR14 retos (self-write signal) ----
// updatedAt de la señal se ancla a request.time (anti-backdating), así que los
// casos allow usan la hora real; los deny usan una hora fabricada.
const nowMs = Date.now();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'colegios/A/asignaciones/reto1'), {
    kind: 'reto',
    reto: { tipo: 'registrar_movimientos', cantidad: 5 },
    target: { tipo: 'curso', cursoId: 'c1' },
    fechaInicio: 1,
    deadline: 9999999999999,
    createdByUid: 'uProfA1',
    createdAt: 1,
  });
  await setDoc(doc(db, 'colegios/A/asignaciones/retoOtro'), {
    kind: 'reto',
    reto: { tipo: 'crear_meta', cantidad: 1 },
    target: { tipo: 'curso', cursoId: 'c2' },
    fechaInicio: 1,
    deadline: 9999999999999,
    createdByUid: 'uProfA1',
    createdAt: 1,
  });
  await setDoc(doc(db, 'colegios/A/asignaciones/mundo1'), {
    worldId: 'world_1',
    target: { tipo: 'curso', cursoId: 'c1' },
    fechaInicio: 1,
    deadline: 9999999999999,
    createdByUid: 'uProfA1',
    createdAt: 1,
  });
});

console.log('Presupuestos config (RQ-ES11, self-only):');
const presu = (uid) => `users/${uid}/config/presupuestos`;
await check(
  'student writes own budgets',
  assertSucceeds(setDoc(doc(stuA1, presu('uStuA1')), { topes: { comida: 20000 }, updatedAt: nowMs }))
);
await check('student reads own budgets', assertSucceeds(getDoc(doc(stuA1, presu('uStuA1')))));
await check(
  'other student cannot write budgets',
  assertFails(setDoc(doc(stuA2, presu('uStuA1')), { topes: { comida: 1 }, updatedAt: nowMs }))
);
await check(
  'profesor cannot read student budgets',
  assertFails(getDoc(doc(profA1, presu('uStuA1'))))
);
await check(
  'budgets rejects wrong docId',
  assertFails(setDoc(doc(stuA1, 'users/uStuA1/config/otro'), { topes: {}, updatedAt: nowMs }))
);
await check(
  'budgets rejects extra key',
  assertFails(setDoc(doc(stuA1, presu('uStuA1')), { topes: {}, updatedAt: nowMs, racha: 1 }))
);
await check(
  'budgets rejects unknown category',
  assertFails(setDoc(doc(stuA1, presu('uStuA1')), { topes: { apuestas: 100 }, updatedAt: nowMs }))
);
await check(
  'budgets rejects zero or negative amounts',
  assertFails(setDoc(doc(stuA1, presu('uStuA1')), { topes: { comida: 0 }, updatedAt: nowMs }))
);
await check(
  'budgets rejects string amounts',
  assertFails(setDoc(doc(stuA1, presu('uStuA1')), { topes: { comida: '20000' }, updatedAt: nowMs }))
);
await check(
  'budgets rejects non-numeric updatedAt',
  assertFails(setDoc(doc(stuA1, presu('uStuA1')), { topes: { comida: 1 }, updatedAt: 'x' }))
);

console.log('Asignaciones shape (mundo | reto):');
const mkAsig = (id) => `colegios/A/asignaciones/${id}`;
const baseAsig = {
  target: { tipo: 'curso', cursoId: 'c1' },
  fechaInicio: 1,
  deadline: 2,
  createdByUid: 'uProfA1',
  createdAt: 1,
};
await check(
  'profesor creates valid mundo',
  assertSucceeds(setDoc(doc(profA1, mkAsig('newMundo')), { worldId: 'world_2', ...baseAsig }))
);
await check(
  'profesor creates valid reto',
  assertSucceeds(
    setDoc(doc(profA1, mkAsig('newReto')), {
      kind: 'reto',
      reto: { tipo: 'registrar_movimientos', cantidad: 5 },
      ...baseAsig,
    })
  )
);
await check(
  'reto rejects tipo not in v1 enum',
  assertFails(
    setDoc(doc(profA1, mkAsig('badTipo')), {
      kind: 'reto',
      reto: { tipo: 'racha_dias', cantidad: 5 },
      ...baseAsig,
    })
  )
);
await check(
  'reto rejects cantidad 0',
  assertFails(
    setDoc(doc(profA1, mkAsig('badCant')), {
      kind: 'reto',
      reto: { tipo: 'crear_meta', cantidad: 0 },
      ...baseAsig,
    })
  )
);
await check(
  'asignacion rejects extra key',
  assertFails(setDoc(doc(profA1, mkAsig('extra')), { worldId: 'world_2', nota: 'x', ...baseAsig }))
);
await check(
  'asignacion rejects foreign createdByUid',
  assertFails(
    setDoc(doc(profA1, mkAsig('spoof')), { worldId: 'world_2', ...baseAsig, createdByUid: 'other' })
  )
);
await check(
  'reto rejects worldId present',
  assertFails(
    setDoc(doc(profA1, mkAsig('mixed')), {
      kind: 'reto',
      worldId: 'world_2',
      reto: { tipo: 'crear_meta', cantidad: 1 },
      ...baseAsig,
    })
  )
);
await check(
  'legacy mundo (no kind) update still allowed',
  assertSucceeds(setDoc(doc(profA1, mkAsig('mundo1')), { worldId: 'world_1', ...baseAsig }))
);
await check(
  'other-colegio profesor cannot create asignacion',
  assertFails(setDoc(doc(profB, mkAsig('cross')), { worldId: 'world_2', ...baseAsig }))
);

await check(
  'student cannot persist diary-derived reto state',
  assertFails(
    setDoc(doc(stuA1, 'colegios/A/cursos/c1/estudiantes/uStuA1/retos/reto1'), {
      estado: 'cumplido',
    })
  )
);
await check(
  're-pin: profesor still cannot read student movimientos (CA5)',
  assertFails(getDoc(doc(profA1, 'users/uStuA1/movimientos/m1')))
);

console.log('Default deny:');
await check('any other path denied', assertFails(getDoc(doc(stuA1, 'randomCol/randomDoc'))));

await env.cleanup();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
