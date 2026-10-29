/**
 * Niveles de un planeta (mapa zigzag). Con todo el banco del mundo se arman:
 *
 * - Lecciones de PREGUNTAS_POR_LECCION preguntas, mezclando tipos y de la más
 *   fácil a la más difícil. Sin vidas: el error se explica y la pregunta vuelve
 *   al final.
 * - Un jefe final de 10 preguntas (4 MC + 3 VF + 3 ordenar, R9) con 3 vidas.
 *   Es el único que da la maestría del mundo, con el puntaje real.
 *
 * Determinista por estudiante (R7): mismo banco + misma semilla = mismos niveles.
 * El jefe usa las mismas semillas por tipo que el quiz anterior, así quien ya
 * había empezado ve las mismas preguntas. Puro.
 */
import { hashStr, stableShuffle } from '@shared/lib/quizUtils';
import type {
  MultipleChoiceItem,
  OrdenarItem,
  QuizItem,
  TrueFalseItem,
} from '@features/learning/data/quiz.types';

export const PREGUNTAS_POR_LECCION = 5;
export const MAX_LECCIONES = 6;
export const JEFE_MC = 4;
export const JEFE_VF = 3;
export const JEFE_ORDENAR = 3;

export interface PoolMundo {
  mc: MultipleChoiceItem[];
  vf: TrueFalseItem[];
  ordenar: OrdenarItem[];
}

export interface NivelesMundo {
  lecciones: QuizItem[][];
  jefe: QuizItem[];
}

export type TipoNivel = 'leccion' | 'jefe';

export function poolSuficiente(pool: PoolMundo): boolean {
  return pool.mc.length >= JEFE_MC && pool.vf.length >= JEFE_VF && pool.ordenar.length >= JEFE_ORDENAR;
}

/** Intercala los tipos (mc, vf, ordenar, mc…) para que cada lección tenga variedad. */
function intercalar(listas: QuizItem[][]): QuizItem[] {
  const out: QuizItem[] = [];
  const largo = Math.max(...listas.map((l) => l.length));
  for (let i = 0; i < largo; i++) for (const l of listas) if (l[i]) out.push(l[i]);
  return out;
}

export function armarNiveles(pool: PoolMundo, semilla: string): NivelesMundo {
  if (!poolSuficiente(pool)) return { lecciones: [], jefe: [] };
  const mc = stableShuffle(pool.mc, hashStr(`${semilla}:multiple_choice`));
  const vf = stableShuffle(pool.vf, hashStr(`${semilla}:true_false`));
  const ord = stableShuffle(pool.ordenar, hashStr(`${semilla}:ordenar`));

  const jefe: QuizItem[] = [
    ...mc.slice(0, JEFE_MC),
    ...vf.slice(0, JEFE_VF),
    ...ord.slice(0, JEFE_ORDENAR),
  ];

  // Orden estable por dificultad: las primeras lecciones son las más amables.
  const todas = intercalar([mc, vf, ord])
    .map((item, i) => ({ item, i }))
    .sort((a, b) => (a.item.dificultad ?? 1) - (b.item.dificultad ?? 1) || a.i - b.i)
    .map(({ item }) => item);
  const cantidad = Math.max(
    1,
    Math.min(MAX_LECCIONES, Math.floor(todas.length / PREGUNTAS_POR_LECCION))
  );
  const lecciones = Array.from({ length: cantidad }, (_, n) =>
    todas.slice(n * PREGUNTAS_POR_LECCION, (n + 1) * PREGUNTAS_POR_LECCION)
  ).filter((l) => l.length > 0);
  return { lecciones, jefe };
}

export type EstadoNodo = 'hecho' | 'actual' | 'bloqueado';

export interface NodoMapa {
  indice: number;
  tipo: TipoNivel;
  estado: EstadoNodo;
}

/**
 * Nodos del mapa. `hechas` = lecciones terminadas (en orden); `conquistado` =
 * el jefe ya se ganó (o el mundo ya estaba dominado antes de existir los niveles).
 */
export function nodosMapa(totalLecciones: number, hechas: number, conquistado: boolean): NodoMapa[] {
  const listas = conquistado ? totalLecciones : Math.min(hechas, totalLecciones);
  const nodos: NodoMapa[] = Array.from({ length: totalLecciones }, (_, i) => ({
    indice: i,
    tipo: 'leccion',
    estado: i < listas ? 'hecho' : i === listas ? 'actual' : 'bloqueado',
  }));
  nodos.push({
    indice: totalLecciones,
    tipo: 'jefe',
    estado: conquistado ? 'hecho' : listas >= totalLecciones ? 'actual' : 'bloqueado',
  });
  return nodos;
}

/**
 * Los cofres son premios ocasionales: solo hay uno a mitad del camino (la 2.ª lección de 4,
 * la 3.ª de 5 o 6) y otro en el jefe. Se entregan la primera vez que se ganan; repetir no da
 * otro. Las demás lecciones pagan sus Cetis igual, sin cofre.
 */
export function leccionConCofre(totalLecciones: number): number {
  return Math.max(0, Math.floor((totalLecciones - 1) / 2));
}

export function tieneCofre(tipo: TipoNivel, nivel: number, totalLecciones: number): boolean {
  return tipo === 'jefe' || nivel === leccionConCofre(totalLecciones);
}

export function ganaCofre(
  tipo: TipoNivel,
  nivel: number,
  totalLecciones: number,
  hechasAntes: number,
  conquistadoAntes: boolean,
  conquistadoAhora: boolean
): boolean {
  if (conquistadoAntes || !tieneCofre(tipo, nivel, totalLecciones)) return false;
  return tipo === 'jefe' ? conquistadoAhora : nivel === hechasAntes;
}

/** Maestría del jefe: preguntas acertadas a la primera sobre el total. */
export function maestriaJefe(total: number, acertadasALaPrimera: number): number {
  return total > 0 ? Math.max(0, Math.min(1, acertadasALaPrimera / total)) : 0;
}
