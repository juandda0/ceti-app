/**
 * Quiz item types for the static question bank (bancos/ collection in Firestore).
 * Fields are in Spanish to match the Firestore document shape authored via the
 * content pipeline (authoring-time). R8: banks are read-only at runtime; R7: no
 * adaptive/ML selection at runtime; R9: exactly 10 items = 4 MC + 3 VF + 3 ordenar.
 */

export type WorldId = 'world_1' | 'world_2' | 'world_3' | 'world_4' | 'world_5';

export type Grado = '9' | '10' | '11';

export type QuizTipo = 'multiple_choice' | 'true_false' | 'ordenar';

// ─── Item interfaces ───────────────────────────────────────────────────────────

interface BaseItem {
  id: string;
  enunciado: string;
  competencia: string;
  dificultad: number;
  explicacion?: string;
}

export interface MultipleChoiceItem extends BaseItem {
  tipo: 'multiple_choice';
  /** Presentation options (shuffled in the bank; UI shows them as-is). */
  opciones: string[];
  /** Index into opciones[] that is correct. */
  correctIndex: number;
}

export interface TrueFalseItem extends BaseItem {
  tipo: 'true_false';
  respuesta: boolean;
}

export interface OrdenarItem extends BaseItem {
  tipo: 'ordenar';
  /** The elements to sort, presented in a random starting order (see R9). */
  elementos: string[];
  /**
   * Canonical order expressed as indices into `elementos[]`.
   * Example: [2, 0, 1] means elementos[2] comes first, then elementos[0], then elements[1].
   * NEVER expose this to the student before they submit (R9).
   */
  ordenCanonico: number[];
}

export type QuizItem = MultipleChoiceItem | TrueFalseItem | OrdenarItem;

// ─── Banco document shape ──────────────────────────────────────────────────────

/**
 * A single Firestore document in the `bancos` top-level collection.
 * Document id: `${grado}_${worldId}_${tipo}` (e.g. "9_world_1_multiple_choice").
 */
export interface BancoDoc {
  bancoId: string;
  grado: Grado;
  worldId: WorldId;
  tipo: QuizTipo;
  version: number;
  generadoPor: string;
  pendiente_validacion_docente: boolean;
  items: QuizItem[];
}
