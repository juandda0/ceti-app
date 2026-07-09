/**
 * Empareja el nombre de meta dicho por voz (RQ-ES10 D-ES10-06, intención
 * abonar_meta) con una meta existente del estudiante. Normaliza (minúsculas, sin
 * tildes) y hace match por inclusión o por token compartido, para tolerar
 * "la bici" -> "Bicicleta".
 */
import type { SavingsGoal } from '@features/savings/store/useSavingsStore';

function normaliza(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes/diacríticos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchGoal(nombre: string, goals: SavingsGoal[]): SavingsGoal | undefined {
  const n = normaliza(nombre);
  if (!n) return undefined;
  const nTokens = n.split(' ').filter((w) => w.length >= 3);

  for (const g of goals) {
    const title = normaliza(g.title);
    if (!title) continue;
    if (title.includes(n) || n.includes(title)) return g;
    const tTokens = title.split(' ').filter((w) => w.length >= 3);
    if (nTokens.some((w) => tTokens.some((tw) => tw.includes(w) || w.includes(tw)))) return g;
  }
  return undefined;
}
