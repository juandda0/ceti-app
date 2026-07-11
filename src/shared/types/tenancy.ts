/**
 * Tenancy & role types for the B2B2C model. Shared across features (auth,
 * dashboard, learning). Source of truth for the schema: docs/data-model.md and
 * docs/requerimientos.md §1.
 *
 * Identity (Ley 1581, R1/R4): a student is keyed by their Firebase Auth `uid`;
 * the only PII stored is `email` + `nombre`. There is NO pseudonym key
 * and NO active sede claim.
 */

// D-PIVOT: only two app roles (profesor + estudiante). `admin` is a backend-only
// claim (provisioning via Admin SDK) with no UI; rector/coordinador removed.
export const ROLES = ['admin', 'profesor', 'estudiante'] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** In-app staff role that operates a course / reads aggregates. */
export const STAFF_ROLES = ['profesor'] as const;

/**
 * Custom claims set on the Firebase Auth token (see functions/). The ONLY
 * trusted source of authorization (R2). `admin` is global (no `colegioId`);
 * `cursoId` only applies to `estudiante`. No pseudonym, no sede claim (R1/R2).
 */
export type CetiClaims = {
  role: Role;
  /** Absent for `admin` (global scope). */
  colegioId?: string;
  /** Only for `estudiante`: the course their roster slot lives under. */
  cursoId?: string;
};

export type Colegio = {
  nombre: string;
  logoUrl?: string;
  plan?: string;
  planMaxEstudiantes?: number;
  /** Dormant (RQ-FN01): always false in MVP; no docs are created under sedes/. */
  sedesEnabled: boolean;
  createdAt: number;
  createdByUid?: string;
};

/** Dormant entity (RQ-FN01/D10). Kept in the schema; never instantiated. */
export type Sede = {
  nombre: string;
};

export type Grado = '9' | '10' | '11';

export type Curso = {
  nombre: string;
  grado: Grado;
  /** Dormant — sedes are inert (RQ-FN01). */
  sedeId?: string;
  /** Auth uids of teachers who manage this course. */
  profesorUids: string[];
  /** Class self-join code (set by the generateClassCode Function). */
  codigo?: string;
  createdAt?: number;
  createdByUid?: string;
};

export type EstudianteEstado = 'pendiente_atestacion' | 'activo' | 'suprimido';

/**
 * Student roster doc, keyed by Auth `uid` (R1). Stores only `email` + `nombre`
 * (R4). The grade is derived from the course, never stored here. Activation is
 * gated by the lightweight acudiente attestation (RQ-FN10): a boolean + who/when,
 * with NO acudiente PII.
 */
export type Estudiante = {
  email: string;
  nombre: string;
  estado: EstudianteEstado;
  /** Lightweight Ley 1581 attestation: the school confirms it holds consent. */
  atestado: boolean;
  /** uid of the staffer/admin who attested (trazabilidad mínima). */
  atestadoPor?: string;
  atestadoAt?: number;
  politicaVersion?: string;
  joinedAt: number;
  suprimidoAt?: number;
  suprimidoPor?: string;
};

/**
 * Per-world progress, stored under the tenant tree so teachers can read it.
 * `colegioId`/`cursoId`/`uid` are denormalized to enable collection-group
 * aggregate queries (RQ-FN08).
 */
export type WorldProgress = {
  colegioId: string;
  cursoId: string;
  /** Auth uid of the student (R1 — replaces the old pseudonym field). */
  uid: string;
  /** CONPES 4005 competency this world maps to. */
  competencia: string;
  /** 0..1 mastery, drives weakness detection and the teacher report. */
  mastery: number;
  quizScores: Record<string, number>;
  completed: boolean;
  completedAt?: number;
  updatedAt: number;
};

/**
 * Which pieces of a world's content this course overrides (RQ-PR11). A true
 * flag means "read `cursos/{cursoId}/contenido/*` instead of the global
 * default" — it is what lets the runtime read exactly one doc per piece.
 */
export type WorldContentOverrides = {
  mc?: boolean;
  vf?: boolean;
  ordenar?: boolean;
  teoria?: boolean;
  eligeCamino?: boolean;
};

/**
 * Runtime pointer to a course's custom content for ONE world (RQ-PR11): the
 * tenant to read `contenido/*` from, the per-piece override flags, and the
 * config version (cache-invalidation key: every content save bumps it).
 */
export type CourseContentRef = {
  colegioId: string;
  cursoId: string;
  overrides?: WorldContentOverrides;
  version: number;
};

/** One entry of the class world list; array position = teaching order. */
export type CursoConfigMundoEntry = {
  worldId: string;
  /** Inactive worlds are invisible to students (a custom-world draft is just an inactive entry). */
  activo: boolean;
  /** Display overrides (RQ-PR11): absent → the default world metadata. */
  nombre?: string;
  subtitle?: string;
  descripcion?: string;
  /**
   * Custom worlds only (RQ-PR12 CA2): assigned CONPES competency id (one of
   * the 5) → counts in diagnosis/compliance; absent → 'personalizada'
   * (progress-only, outside the compliance report).
   */
  competencia?: string;
};

/**
 * Class configuration doc (D-ORQ, RQ-PR10), single doc at
 * `cursos/{cursoId}/config/mundos`. ABSENCE of the doc = defaults (the 5
 * default worlds, canonical order, all active, modo libre) — that is what keeps
 * pre-existing courses working with zero migration. Written only by the course
 * profesor; read by the course (students subscribe via onSnapshot).
 */
export type CursoConfigMundos = {
  /** Ordered world list; order here IS the unlock order. */
  mundos: CursoConfigMundoEntry[];
  /** "The class works only on world X" toggle (persistent, no schedule). */
  modoEnfocado: { activo: boolean; worldId?: string };
  /** Per-world content override flags (RQ-PR11), keyed by worldId. */
  overrides?: Record<string, WorldContentOverrides>;
  version: number;
  updatedAt: number;
  updatedByUid: string;
};

export type AsignacionTarget =
  | { tipo: 'curso'; cursoId: string }
  | { tipo: 'estudiante'; cursoId: string; uid: string };

export type Asignacion = {
  worldId: string;
  target: AsignacionTarget;
  fechaInicio: number;
  deadline: number;
  createdByUid: string;
  createdAt: number;
};

/**
 * Per-course aggregate roll-up (RQ-FN09). NO individual minor data: the
 * Elige-camino output is a counter per situation/option, never tied to a student.
 */
export type Agregado = {
  competencia?: string;
  masteryPromedio?: number;
  distribucion?: Record<string, number>;
  eligeCamino?: Record<string, { opcionA: number; opcionB: number }>;
  updatedAt: number;
};

/** Impact pre/post test result (RQ-TS01..TS04), keyed by fase. */
export type ImpactFase = 'pre' | 'post';
export type ImpactTest = {
  score: number;
  total: number;
  takenAt: number;
  breakdown: Record<string, number>;
};

/** uid → tenant mapping (non-authoritative mirror) used at bootstrap and listing. */
export type Membership = {
  role: Role;
  colegioId?: string;
  cursoId?: string;
};
