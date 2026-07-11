import { collection, doc, query, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

export const FIRESTORE_COLLECTIONS = {
  // Account-scoped (auth user). Savings/goals here are SIMULATED (virtual money).
  users: 'users',
  goals: 'goals',
  deposits: 'deposits',
  // Pocket-money diary (RQ-ES10): REAL self-declared movements, self-only
  // (isSelf; no staff/admin read — CA5). Deleted by suppressStudentData (CA7).
  movimientos: 'movimientos',
  // Global, human-curated, read-only to clients (R8). Doc id: `${grado}_${worldId}_${tipo}`.
  bancos: 'bancos',
  // EligeCamino situational banks. Doc id: `${grado}_${worldId}`.
  bancosEligeCamino: 'bancosEligeCamino',
  // Micro-theory card banks. Doc id: `${grado}_${worldId}`.
  microteoria: 'microteoria',
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
  // D-ORQ (RQ-PR10): per-course class configuration (single doc `mundos`).
  config: 'config',
} as const;

/** Fixed doc id of the class-config doc under `cursos/{cursoId}/config/`. */
export const CURSO_CONFIG_MUNDOS_DOC_ID = 'mundos';

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

export function userMovimientosCollectionRef(db: Firestore, uid: string) {
  return collection(db, FIRESTORE_COLLECTIONS.users, uid, FIRESTORE_COLLECTIONS.movimientos);
}

export function userMovimientoDocRef(db: Firestore, uid: string, movimientoId: string) {
  return doc(db, FIRESTORE_COLLECTIONS.users, uid, FIRESTORE_COLLECTIONS.movimientos, movimientoId);
}

/**
 * Reference to a single banco document.
 * Doc id: `${grado}_${worldId}_${tipo}` (e.g. "9_world_1_multiple_choice").
 * R8: bancos are read-only to clients; writes go through Admin SDK / pipeline.
 */
export function bancoDocRef(db: Firestore, grado: string, worldId: string, tipo: string) {
  return doc(db, FIRESTORE_COLLECTIONS.bancos, `${grado}_${worldId}_${tipo}`);
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

/**
 * Class configuration doc (D-ORQ, RQ-PR10):
 * `colegios/{colegioId}/cursos/{cursoId}/config/mundos`.
 * Absence of the doc = defaults. Written only by the course profesor (rules);
 * students of the course read it (live, via onSnapshot).
 */
export function cursoConfigMundosDocRef(db: Firestore, colegioId: string, cursoId: string) {
  return doc(db, C.colegios, colegioId, C.cursos, cursoId, C.config, CURSO_CONFIG_MUNDOS_DOC_ID);
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

/**
 * Reference to an EligeCamino banco document.
 * Doc id: `${grado}_${worldId}` (e.g. "9_world_1").
 * R8: read-only to clients; written via Admin SDK / content pipeline.
 */
export function eligeCaminoDocRef(db: Firestore, grado: string, worldId: string) {
  return doc(db, FIRESTORE_COLLECTIONS.bancosEligeCamino, `${grado}_${worldId}`);
}

/**
 * Reference to a micro-theory banco document.
 * Doc id: `${grado}_${worldId}` (e.g. "9_world_1").
 * R8: read-only to clients; written via Admin SDK / content pipeline.
 */
export function microteoriaDocRef(db: Firestore, grado: string, worldId: string) {
  return doc(db, FIRESTORE_COLLECTIONS.microteoria, `${grado}_${worldId}`);
}
