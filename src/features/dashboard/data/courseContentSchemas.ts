/**
 * Validation + builders for professor-authored content (D-ORQ, RQ-PR11).
 * Zod is the deep client-side gate (rules only check ownership/shape caps).
 *
 * Quiz minimums mirror R9 (4 MC + 3 V/F + 3 ordenar): a piece can't be saved
 * below the quiz's sampling needs, so the class never breaks (RQ-PR11 CA5).
 */
import { z } from 'zod';
import { hashStr, stableShuffle } from '@shared/lib/quizUtils';
import type {
  MultipleChoiceItem,
  OrdenarItem,
  QuizItem,
  TrueFalseItem,
} from '@features/learning/data/quiz.types';

export const QUIZ_MINIMUMS = { mc: 4, vf: 3, ordenar: 3, teoria: 1 } as const;

const baseItem = {
  id: z.string().min(1),
  enunciado: z.string().trim().min(8).max(400),
  competencia: z.string().min(1),
  dificultad: z.number().min(1).max(5),
  explicacion: z.string().trim().max(400).optional(),
};

export const mcItemSchema = z.object({
  ...baseItem,
  opciones: z.array(z.string().trim().min(1).max(160)).min(3).max(5),
  correctIndex: z.number().int().min(0),
});

export const vfItemSchema = z.object({
  ...baseItem,
  respuesta: z.boolean(),
});

export const ordenarItemSchema = z.object({
  ...baseItem,
  elementos: z.array(z.string().trim().min(1).max(160)).min(3).max(6),
  ordenCanonico: z.array(z.number().int().min(0)),
});

export const microteoriaCardSchema = z.object({
  titulo: z.string().trim().min(2).max(80),
  cuerpo: z.string().trim().min(10).max(600),
  ejemplo: z.string().trim().max(400).optional(),
});

/** Validates one quiz item by its tipo; returns an error message or null. */
export function validateQuizItem(item: QuizItem): string | null {
  const schema =
    item.tipo === 'multiple_choice'
      ? mcItemSchema
      : item.tipo === 'true_false'
        ? vfItemSchema
        : ordenarItemSchema;
  const result = schema.safeParse(item);
  if (!result.success) {
    const issue = result.error.issues[0];
    return `${issue.path.join('.')}: ${issue.message}`;
  }
  if (item.tipo === 'multiple_choice' && item.correctIndex >= item.opciones.length) {
    return 'correctIndex fuera de rango';
  }
  if (item.tipo === 'ordenar') {
    const n = item.elementos.length;
    const sorted = [...item.ordenCanonico].sort((a, b) => a - b);
    if (sorted.length !== n || sorted.some((v, i) => v !== i)) {
      return 'ordenCanonico inválido';
    }
  }
  return null;
}

/**
 * Builds an `ordenar` item from elements written in their CORRECT order (the
 * natural authoring form). Elements are shuffled DETERMINISTICALLY (seeded by
 * id+enunciado — no Math.random, R7-friendly) before storing, because the quiz
 * UI presents `elementos` as stored: storing them in canonical order would
 * leak the answer. If the shuffle lands on the identity permutation, it is
 * rotated by one.
 */
export function buildOrdenarElements(
  id: string,
  enunciado: string,
  elementsInCorrectOrder: string[]
): { elementos: string[]; ordenCanonico: number[] } {
  const seed = hashStr(`${id}:${enunciado}`);
  const indexed = elementsInCorrectOrder.map((el, canonicalPos) => ({ el, canonicalPos }));
  let shuffled = stableShuffle(indexed, seed);
  if (shuffled.every((s, i) => s.canonicalPos === i) && shuffled.length > 1) {
    shuffled = [...shuffled.slice(1), shuffled[0]];
  }
  const elementos = shuffled.map((s) => s.el);
  const ordenCanonico = elementsInCorrectOrder.map((_, canonicalPos) =>
    shuffled.findIndex((s) => s.canonicalPos === canonicalPos)
  );
  return { elementos, ordenCanonico };
}

/** Elements of an ordenar item in canonical order (the editing form). */
export function canonicalElements(item: OrdenarItem): string[] {
  return item.ordenCanonico.map((idx) => item.elementos[idx]);
}

/**
 * Draft world returned by the `generarBorradorMundo` Function (RQ-CN06).
 * `ordenar.elementosCorrectos` come in their CORRECT order; the client builds
 * the stored (shuffled) form via `buildOrdenarElements`.
 */
export type MundoBorrador = {
  nombre: string;
  subtitle: string;
  descripcion: string;
  teoria: { titulo: string; cuerpo: string; ejemplo?: string }[];
  mc: { enunciado: string; opciones: string[]; correctIndex: number; explicacion?: string }[];
  vf: { enunciado: string; respuesta: boolean; explicacion?: string }[];
  ordenar: { enunciado: string; elementosCorrectos: string[]; explicacion?: string }[];
  eligeCamino: {
    enunciado: string;
    opcionA: { texto: string; consecuencia: string };
    opcionB: { texto: string; consecuencia: string };
  }[];
};

/** Content tipos the editor can generate one item at a time (RQ-CN06). */
export type BorradorItemTipo = 'mc' | 'vf' | 'ordenar' | 'teoria';
export type BorradorTeoriaCard = MundoBorrador['teoria'][number];
export type BorradorMcItem = MundoBorrador['mc'][number];
export type BorradorVfItem = MundoBorrador['vf'][number];
export type BorradorOrdenarItem = MundoBorrador['ordenar'][number];
/** One item returned by `generarItemContenido`, shape depends on the tipo asked. */
export type BorradorItem =
  | BorradorMcItem
  | BorradorVfItem
  | BorradorOrdenarItem
  | BorradorTeoriaCard;

/**
 * Converts an accepted IA draft into the content docs of a custom world.
 * Everything generated is stamped `generadoPor:'ia'` +
 * `pendiente_validacion_docente:true` (RQ-CN06 CA3) — honest provenance; the
 * professor already reviews before saving.
 */
export function buildPiecesFromDraft(
  draft: MundoBorrador,
  grado: string,
  worldId: string,
  competencia: string
): Record<'mc' | 'vf' | 'ordenar' | 'teoria' | 'eligeCamino', Record<string, unknown>> {
  const dificultad = (i: number) => Math.min(3, 1 + Math.floor(i / 2));
  const bancoShell = (tipo: string, items: unknown[]) => ({
    bancoId: `banco_${worldId}_${tipo}`,
    grado,
    worldId,
    tipo,
    version: 1,
    generadoPor: 'ia',
    pendiente_validacion_docente: true,
    items,
  });
  return {
    mc: bancoShell(
      'multiple_choice',
      draft.mc.map((q, i) => ({
        id: `ia_mc_${i}`,
        tipo: 'multiple_choice',
        enunciado: q.enunciado,
        competencia,
        dificultad: dificultad(i),
        opciones: q.opciones,
        correctIndex: q.correctIndex,
        ...(q.explicacion ? { explicacion: q.explicacion } : {}),
      }))
    ),
    vf: bancoShell(
      'true_false',
      draft.vf.map((q, i) => ({
        id: `ia_vf_${i}`,
        tipo: 'true_false',
        enunciado: q.enunciado,
        competencia,
        dificultad: dificultad(i),
        respuesta: q.respuesta,
        ...(q.explicacion ? { explicacion: q.explicacion } : {}),
      }))
    ),
    ordenar: bancoShell(
      'ordenar',
      draft.ordenar.map((q, i) => {
        const id = `ia_ord_${i}`;
        const built = buildOrdenarElements(id, q.enunciado, q.elementosCorrectos);
        return {
          id,
          tipo: 'ordenar',
          enunciado: q.enunciado,
          competencia,
          dificultad: dificultad(i),
          elementos: built.elementos,
          ordenCanonico: built.ordenCanonico,
          ...(q.explicacion ? { explicacion: q.explicacion } : {}),
        };
      })
    ),
    teoria: {
      grado,
      worldId,
      cards: draft.teoria,
      generadoPor: 'ia',
      pendiente_validacion_docente: true,
    },
    eligeCamino: {
      bancoId: `eligeCamino_${worldId}`,
      grado,
      worldId,
      situaciones: draft.eligeCamino.map((s, i) => ({
        id: `ia_ec_${i}`,
        enunciado: s.enunciado,
        opcionA: s.opcionA,
        opcionB: s.opcionB,
      })),
      generadoPor: 'ia',
      pendiente_validacion_docente: true,
    },
  };
}

/** Builders for empty new items (editor "añadir"). */
export function newMcItem(id: string, competencia: string): MultipleChoiceItem {
  return {
    id,
    tipo: 'multiple_choice',
    enunciado: '',
    competencia,
    dificultad: 2,
    opciones: ['', '', '', ''],
    correctIndex: 0,
  };
}

export function newVfItem(id: string, competencia: string): TrueFalseItem {
  return { id, tipo: 'true_false', enunciado: '', competencia, dificultad: 2, respuesta: true };
}

export function newOrdenarItem(id: string, competencia: string): OrdenarItem {
  return {
    id,
    tipo: 'ordenar',
    enunciado: '',
    competencia,
    dificultad: 2,
    elementos: ['', '', ''],
    ordenCanonico: [0, 1, 2],
  };
}
