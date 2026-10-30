/**
 * Mi banco de preguntas (Fase 4): forma de cada pregunta guardada y cómo se
 * limpian sus temas y se busca en el banco. Puro; la lectura y escritura están
 * en `bancoProfeRepository`.
 */
import type { QuizItem } from '@features/learning/data/quiz.types';

export const MAX_TEMAS = 10;

export interface PreguntaGuardada {
  id: string;
  item: QuizItem;
  tipo: QuizItem['tipo'];
  temas: string[];
  origen: { cursoId: string; worldId: string } | null;
  creadoAt: number;
}

/** Temas limpios: sin vacíos ni repetidos (sin importar mayúsculas), máximo 10. */
export function limpiarTemas(temas: string[]): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const t of temas) {
    const limpio = t.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!limpio || vistos.has(limpio.toLowerCase())) continue;
    vistos.add(limpio.toLowerCase());
    out.push(limpio);
  }
  return out.slice(0, MAX_TEMAS);
}

/** Preguntas que cumplen la búsqueda (texto o tema) y el tipo. */
export function filtrarBanco(
  preguntas: PreguntaGuardada[],
  { texto, tema, tipo }: { texto?: string; tema?: string | null; tipo?: QuizItem['tipo'] | null }
): PreguntaGuardada[] {
  const q = (texto ?? '').trim().toLowerCase();
  return preguntas
    .filter((p) => !tipo || p.tipo === tipo)
    .filter((p) => !tema || p.temas.includes(tema))
    .filter(
      (p) =>
        !q ||
        p.item.enunciado.toLowerCase().includes(q) ||
        p.temas.some((t) => t.toLowerCase().includes(q))
    )
    .sort((a, b) => b.creadoAt - a.creadoAt);
}
