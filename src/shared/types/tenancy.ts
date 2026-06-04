/**
 * Tenancy & role types for the B2B2C model. Shared across features (auth,
 * dashboard, learning). Source of truth for the schema: docs/data-model.md.
 *
 * PII minimization (Ley 1581): a student is keyed by `studentId`, a
 * school-provided pseudonym — never by personal name/email/age.
 */

export const ROLES = ['rector', 'coordinador', 'profesor', 'estudiante'] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Staff roles that can read aggregates beyond a single student. */
export const STAFF_ROLES = ['rector', 'coordinador', 'profesor'] as const;

/** Custom claims set on the Firebase Auth token (see functions/). */
export type CetiClaims = {
  role: Role;
  colegioId: string;
  /** Optional in MVP (sedes deferred). */
  sedeId?: string;
  /** Only for `estudiante`: the school pseudonym. */
  studentId?: string;
  /** Only for `estudiante`: the course their roster slot lives under. */
  cursoId?: string;
  /** Platform super-admin (registers/administers colegios). UI gate only; the
   * Cloud Functions independently enforce the CETI_SUPERADMIN_EMAILS allowlist. */
  superadmin?: boolean;
};

export type Colegio = {
  nombre: string;
  logoUrl?: string;
  plan?: string;
  planMaxEstudiantes?: number;
  /** When false, a single implicit sede is assumed (MVP default). */
  sedesEnabled: boolean;
  createdAt: number;
};

export type Sede = {
  nombre: string;
};

export type Curso = {
  nombre: string;
  grado: string;
  sedeId?: string;
  /** Auth uids of teachers who manage this course. */
  profesorUids: string[];
  /** Teacher-toggled class collaboration (no public leaderboard). */
  colaboracionAula: boolean;
  /** Class self-join code (set by the generateClassCode Function). */
  codigo?: string;
};

export type EstudianteEstado = 'pendiente_autorizacion' | 'activo' | 'suprimido';

export type Estudiante = {
  /** Non-identifying label shown to staff (e.g. "Estudiante 12"). */
  displayLabel: string;
  estado: EstudianteEstado;
  /** Auth uid linked once the student logs in. */
  uidVinculado?: string;
  createdAt: number;
};

/**
 * Per-world progress, stored under the tenant tree so teachers can read it.
 * `colegioId`/`cursoId`/`studentId` are denormalized to enable collection-group
 * aggregate queries (F6/F9).
 */
export type WorldProgress = {
  colegioId: string;
  cursoId: string;
  studentId: string;
  /** CONPES 4005 competency this world maps to (F5). */
  competencia: string;
  xp: number;
  nivel: number;
  /** 0..1 mastery, drives mastery-based badges and weakness detection. */
  mastery: number;
  quizScores: Record<string, number>;
  badges: string[];
  completed: boolean;
  completedAt?: number;
  updatedAt: number;
};

export type AsignacionTarget =
  | { tipo: 'curso'; cursoId: string }
  | { tipo: 'estudiante'; cursoId: string; studentId: string };

export type Asignacion = {
  worldId: string;
  target: AsignacionTarget;
  fechaInicio: number;
  deadline: number;
  createdByUid: string;
  createdAt: number;
};

export type AutorizacionEstado = 'pendiente' | 'otorgada' | 'revocada';

/** Ley 1581 consent register entry, keyed by studentId. */
export type Autorizacion = {
  estado: AutorizacionEstado;
  politicaVersion: string;
  otorgadaAt?: number;
  canalEvidencia?: string;
  acudienteRef?: string;
};

/**
 * Class leaderboard entry (V2 collaboration). Minimal by design — only a
 * non-identifying label + XP, written by the student, read by course-mates only
 * when the teacher enables colaboracionAula. Never exposes per-competency data.
 */
export type LeaderboardEntry = {
  studentId: string;
  displayLabel: string;
  xp: number;
  updatedAt: number;
};

/** uid → tenant mapping used at bootstrap and by rules helpers. */
export type Membership = {
  colegioId: string;
  sedeId?: string;
  role: Role;
  cursoIds?: string[];
  studentId?: string;
};
