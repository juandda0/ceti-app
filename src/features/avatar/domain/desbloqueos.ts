/**
 * Qué prendas y accesorios tiene ganados la persona. Se calcula con lo que la
 * app ya registra (racha de quizzes, días aprendiendo y metas cumplidas); lo
 * ganado se guarda aparte para que no se pierda si la racha se rompe. Puro.
 */
import { ACCESORIOS, PRENDAS, requisitoDe, type ItemId, type Requisito } from './catalogo';

export type ProgresoAvatar = {
  /** Racha viva de días seguidos con al menos un quiz. */
  rachaQuiz: number;
  /** Días distintos con al menos un quiz, seguidos o no. */
  diasAprendiendo: number;
  metasCumplidas: number;
};

export function cumpleRequisito(req: Requisito, prog: ProgresoAvatar): boolean {
  switch (req.tipo) {
    case 'libre':
      return true;
    case 'racha':
      return prog.rachaQuiz >= req.dias;
    case 'dias-aprendiendo':
      return prog.diasAprendiendo >= req.dias;
    case 'meta-cumplida':
      return prog.metasCumplidas >= 1;
  }
}

/** Avance hacia un requisito con meta numérica (p. ej. racha 4/7); null si no aplica. */
export function avanceDe(
  req: Requisito,
  prog: ProgresoAvatar
): { actual: number; meta: number } | null {
  if (req.tipo === 'racha') return { actual: Math.min(prog.rachaQuiz, req.dias), meta: req.dias };
  if (req.tipo === 'dias-aprendiendo') {
    return { actual: Math.min(prog.diasAprendiendo, req.dias), meta: req.dias };
  }
  return null;
}

const CON_REQUISITO: readonly ItemId[] = [...PRENDAS, ...ACCESORIOS]
  .filter((i) => i.requisito.tipo !== 'libre')
  .map((i) => i.id);

/** Ítems con requisito que el progreso actual ya cumple. */
export function itemsCumplidos(prog: ProgresoAvatar): ItemId[] {
  return CON_REQUISITO.filter((id) => cumpleRequisito(requisitoDe(id), prog));
}

export function estaDisponible(id: ItemId, ganados: readonly string[]): boolean {
  return requisitoDe(id).tipo === 'libre' || ganados.includes(id);
}
