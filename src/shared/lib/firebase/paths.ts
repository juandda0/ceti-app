import { collection, collectionGroup, doc, query, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

export const FIRESTORE_COLLECTIONS = {
  // Account-scoped (auth user). Savings/goals here are SIMULATED (virtual money).
  users: 'users',
  goals: 'goals',
  deposits: 'deposits',
  lessonProgress: 'lessonProgress',
  wallet: 'wallet',
  aiProfile: 'aiProfile',
  // Global, human-curated, read-only to clients.
  questionBank: 'questionBank',
  // Tenancy tree (B2B2C). See docs/data-model.md.
  colegios: 'colegios',
  sedes: 'sedes',
  cursos: 'cursos',
  estudiantes: 'estudiantes',
  progress: 'progress',
  impactTest: 'impactTest',
  agregados: 'agregados',
  asignaciones: 'asignaciones',
  membership: 'membership',
  // Class-level leaderboard (V2) — minimal {displayLabel, xp} per student,
  // readable by course-mates only when colaboracionAula is on. No global board.
  leaderboard: 'leaderboard',
} as const;

export const WALLET_STATE_DOC_ID = 'state';

export function userDocPath(uid: string): string {
  return `${FIRESTORE_COLLECTIONS.users}/${uid}`;
}

export function userDocRef(db: import('firebase/firestore').Firestore, uid: string) {
  return doc(db, FIRESTORE_COLLECTIONS.users, uid);
}

export function userGoalsCollectionRef(db: import('firebase/firestore').Firestore, uid: string) {
  return collection(db, FIRESTORE_COLLECTIONS.users, uid, FIRESTORE_COLLECTIONS.goals);
}

export function userGoalDocRef(
  db: import('firebase/firestore').Firestore,
  uid: string,
  goalId: string
) {
  return doc(db, FIRESTORE_COLLECTIONS.users, uid, FIRESTORE_COLLECTIONS.goals, goalId);
}

export function userDepositsCollectionRef(db: import('firebase/firestore').Firestore, uid: string) {
  return collection(db, FIRESTORE_COLLECTIONS.users, uid, FIRESTORE_COLLECTIONS.deposits);
}

export function userDepositDocRef(
  db: import('firebase/firestore').Firestore,
  uid: string,
  depositId: string
) {
  return doc(db, FIRESTORE_COLLECTIONS.users, uid, FIRESTORE_COLLECTIONS.deposits, depositId);
}

export function userLessonProgressCollectionRef(
  db: import('firebase/firestore').Firestore,
  uid: string
) {
  return collection(db, FIRESTORE_COLLECTIONS.users, uid, FIRESTORE_COLLECTIONS.lessonProgress);
}

export function userLessonProgressDocRef(
  db: import('firebase/firestore').Firestore,
  uid: string,
  lessonId: string
) {
  return doc(db, FIRESTORE_COLLECTIONS.users, uid, FIRESTORE_COLLECTIONS.lessonProgress, lessonId);
}

export function userWalletDocRef(db: Firestore, uid: string) {
  return doc(
    db,
    FIRESTORE_COLLECTIONS.users,
    uid,
    FIRESTORE_COLLECTIONS.wallet,
    WALLET_STATE_DOC_ID
  );
}

export function userAiProfileDocRef(db: Firestore, uid: string) {
  return doc(db, FIRESTORE_COLLECTIONS.users, uid, FIRESTORE_COLLECTIONS.aiProfile, 'state');
}

export function questionBankByWorldQuery(db: Firestore, worldId: string) {
  return query(collection(db, FIRESTORE_COLLECTIONS.questionBank), where('worldId', '==', worldId));
}

// ---------------------------------------------------------------------------
// Tenancy tree: colegio → (sede, dormant) → curso → estudiante → progress.
// See docs/data-model.md. Students are keyed by their Auth `uid` (R1) — there is
// no school-provided pseudonym key.
// ---------------------------------------------------------------------------

const C = FIRESTORE_COLLECTIONS;

export function colegioDocRef(db: Firestore, colegioId: string) {
  return doc(db, C.colegios, colegioId);
}

export function sedesCollectionRef(db: Firestore, colegioId: string) {
  return collection(db, C.colegios, colegioId, C.sedes);
}

export function sedeDocRef(db: Firestore, colegioId: string, sedeId: string) {
  return doc(db, C.colegios, colegioId, C.sedes, sedeId);
}

export function cursosCollectionRef(db: Firestore, colegioId: string) {
  return collection(db, C.colegios, colegioId, C.cursos);
}

export function cursoDocRef(db: Firestore, colegioId: string, cursoId: string) {
  return doc(db, C.colegios, colegioId, C.cursos, cursoId);
}

/** Courses a teacher manages (uid ∈ profesorUids). */
export function cursosByProfesorQuery(db: Firestore, colegioId: string, uid: string) {
  return query(cursosCollectionRef(db, colegioId), where('profesorUids', 'array-contains', uid));
}

export function estudiantesCollectionRef(db: Firestore, colegioId: string, cursoId: string) {
  return collection(db, C.colegios, colegioId, C.cursos, cursoId, C.estudiantes);
}

export function estudianteDocRef(db: Firestore, colegioId: string, cursoId: string, uid: string) {
  return doc(db, C.colegios, colegioId, C.cursos, cursoId, C.estudiantes, uid);
}

export function estudianteProgressCollectionRef(
  db: Firestore,
  colegioId: string,
  cursoId: string,
  uid: string
) {
  return collection(db, C.colegios, colegioId, C.cursos, cursoId, C.estudiantes, uid, C.progress);
}

export function estudianteProgressDocRef(
  db: Firestore,
  colegioId: string,
  cursoId: string,
  uid: string,
  worldId: string
) {
  return doc(db, C.colegios, colegioId, C.cursos, cursoId, C.estudiantes, uid, C.progress, worldId);
}

/** Pre/post impact test docs for a student (RQ-TS01..TS04). */
export function estudianteImpactTestDocRef(
  db: Firestore,
  colegioId: string,
  cursoId: string,
  uid: string,
  fase: 'pre' | 'post'
) {
  return doc(db, C.colegios, colegioId, C.cursos, cursoId, C.estudiantes, uid, C.impactTest, fase);
}

/** Per-course aggregates roll-up (RQ-FN09). No individual minor data. */
export function agregadosCollectionRef(db: Firestore, colegioId: string, cursoId: string) {
  return collection(db, C.colegios, colegioId, C.cursos, cursoId, C.agregados);
}

export function agregadoDocRef(
  db: Firestore,
  colegioId: string,
  cursoId: string,
  agregadoId: string
) {
  return doc(db, C.colegios, colegioId, C.cursos, cursoId, C.agregados, agregadoId);
}

export function asignacionesCollectionRef(db: Firestore, colegioId: string) {
  return collection(db, C.colegios, colegioId, C.asignaciones);
}

export function asignacionDocRef(db: Firestore, colegioId: string, asignacionId: string) {
  return doc(db, C.colegios, colegioId, C.asignaciones, asignacionId);
}

/** Assignments targeting a course (covers both course- and student-targeted). */
export function asignacionesByCursoQuery(db: Firestore, colegioId: string, cursoId: string) {
  return query(asignacionesCollectionRef(db, colegioId), where('target.cursoId', '==', cursoId));
}

/** uid → tenant mapping, used at bootstrap to resolve where a user belongs. */
export function membershipDocRef(db: Firestore, uid: string) {
  return doc(db, C.membership, uid);
}

/** Class leaderboard entries for a course (V2 class collaboration). */
export function leaderboardCollectionRef(db: Firestore, colegioId: string, cursoId: string) {
  return collection(db, C.colegios, colegioId, C.cursos, cursoId, C.leaderboard);
}

export function leaderboardDocRef(db: Firestore, colegioId: string, cursoId: string, uid: string) {
  return doc(db, C.colegios, colegioId, C.cursos, cursoId, C.leaderboard, uid);
}

/**
 * Collection-group query over every student's per-world progress.
 * Used by teacher/rector aggregate reports (F6/F9). Reads are gated by
 * role/tenant rules; callers must still scope by colegioId in the query.
 */
export function progressGroupByColegioQuery(db: Firestore, colegioId: string) {
  return query(collectionGroup(db, C.progress), where('colegioId', '==', colegioId));
}
