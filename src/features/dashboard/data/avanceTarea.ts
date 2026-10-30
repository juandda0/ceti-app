/**
 * Quién cumplió una tarea de mundo: los que deben hacerla (toda la clase o un
 * estudiante) que ya conquistaron ese mundo, y cuántos lo hicieron después de
 * la fecha. Los retos financieros no se miden aquí: su avance es privado del
 * estudiante (RQ-PR14). Puro.
 */
import type { AsignacionAny, WorldProgress } from '@shared/types/tenancy';

export interface AvanceTarea {
  /** Estudiantes que deben hacerla. */
  total: number;
  /** De esos, los que ya conquistaron el mundo. */
  hechas: number;
  /** De las hechas, las que llegaron después de la fecha límite. */
  tarde: number;
}

export function avanceDeTarea(
  tarea: AsignacionAny,
  enClase: readonly string[],
  progreso: readonly (Pick<WorldProgress, 'uid' | 'completed' | 'completedAt'> & {
    worldId: string;
  })[]
): AvanceTarea | null {
  if (tarea.kind === 'reto') return null;
  const { target } = tarea;
  const deben =
    target.tipo === 'estudiante' ? enClase.filter((uid) => uid === target.uid) : [...enClase];
  const debenSet = new Set(deben);
  let hechas = 0;
  let tarde = 0;
  const contados = new Set<string>();
  for (const p of progreso) {
    if (
      p.worldId !== tarea.worldId ||
      !p.completed ||
      !debenSet.has(p.uid) ||
      contados.has(p.uid)
    ) {
      continue;
    }
    contados.add(p.uid);
    hechas += 1;
    if (typeof p.completedAt === 'number' && p.completedAt > tarea.deadline) tarde += 1;
  }
  return { total: deben.length, hechas, tarde };
}
