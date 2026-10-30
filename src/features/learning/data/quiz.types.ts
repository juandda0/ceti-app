/**
 * Quiz item types for the static question bank (bancos/ collection in Firestore).
 * Fields are in Spanish to match the Firestore document shape authored via the
 * content pipeline (authoring-time). R8: banks are read-only at runtime; R7: no
 * adaptive/ML selection at runtime; R9: exactly 10 items = 4 MC + 3 VF + 3 ordenar.
 */

/** The closed set of DEFAULT (Ceti) worlds — use where exhaustiveness matters. */
export type DefaultWorldId = 'world_1' | 'world_2' | 'world_3' | 'world_4' | 'world_5';

/**
 * D-ORQ (RQ-PR12): professors create custom worlds (`cw_*` ids), so a WorldId
 * is any string. Custom ids never collide with the default set.
 */
export type WorldId = string;

/** Grados de un curso: 1° a 11° (el profesor elige al crear la clase). */
export type Grado = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11';

/**
 * Grados con banco default sembrado (E12: grado×mundo×tipo). Un curso de grado
 * menor reutiliza el banco de 9° hasta que el profesor autore contenido propio.
 */
export const SEEDED_GRADOS: readonly Grado[] = ['9', '10', '11'];

export type QuizTipo = 'multiple_choice' | 'true_false' | 'ordenar';
/** Tipos que solo escribe el profe (Fase 4); van en las lecciones, nunca en el jefe. */
export type QuizTipoExtra = 'emparejar' | 'completar' | 'numerica';

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

/** Emparejar: cada concepto de la izquierda con su pareja de la derecha (3 a 5 pares). */
export interface EmparejarItem extends BaseItem {
  tipo: 'emparejar';
  /** En el orden correcto; la columna derecha se baraja al mostrarla. */
  pares: { izquierda: string; derecha: string }[];
}

/** Completar: el enunciado lleva "___" donde va la palabra; se elige entre opciones. */
export interface CompletarItem extends BaseItem {
  tipo: 'completar';
  opciones: string[];
  correctIndex: number;
}

/** Respuesta numérica: el estudiante escribe un número (acepta "1.500" y "2,5"). */
export interface NumericaItem extends BaseItem {
  tipo: 'numerica';
  respuesta: number;
  /** Diferencia aceptada (0 = exacta). */
  tolerancia: number;
  /** Lo que se muestra al lado: "pesos", "%", "meses"… */
  unidad?: string;
}

export type QuizItemExtra = EmparejarItem | CompletarItem | NumericaItem;
export type QuizItem = MultipleChoiceItem | TrueFalseItem | OrdenarItem | QuizItemExtra;

// ─── Banco document shape ──────────────────────────────────────────────────────

/**
 * A single Firestore document in the `bancos` top-level collection.
 * Document id: `${grado}_${worldId}_${tipo}` (e.g. "9_world_1_multiple_choice").
 */
export interface BancoDoc {
  bancoId: string;
  grado: Grado;
  worldId: WorldId;
  tipo: QuizTipo | QuizTipoExtra;
  version: number;
  generadoPor: string;
  pendiente_validacion_docente: boolean;
  items: QuizItem[];
}
