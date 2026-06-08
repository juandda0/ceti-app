/**
 * Unidades del camino de aprendizaje (estilo Duolingo: sección + nodos sin texto).
 * MVP: una sola unidad con todas las lecciones actuales.
 */
export const LEARN_UNITS = [
  {
    id: 'fundamentos-1',
    title: 'Sección 1: Entender el Dinero',
    subtitle: 'Aprende qué es el dinero y cómo usarlo bien en tu día a día.',
    lessonRange: { start: 0, end: 4 },
  },
  {
    id: 'fundamentos-2',
    title: 'Sección 2: Ahorro y Metas',
    subtitle: 'Aprende a guardar dinero y cumplir metas pequeñas paso a paso.',
    lessonRange: { start: 5, end: 9 },
  },
  {
    id: 'fundamentos-3',
    title: 'Sección 3: Presupuesto Básico',
    subtitle: 'Organiza tu dinero de forma simple para que te alcance mejor.',
    lessonRange: { start: 10, end: 14 },
  },
] as const;

export type LearnUnit = (typeof LEARN_UNITS)[number];
