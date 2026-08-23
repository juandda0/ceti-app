/**
 * Evaluador de retos financieros (RQ-PR14-CA5): computa el estado de un reto
 * desde los stores LOCALES del estudiante (gastos/metas/operaciones) sobre la
 * ventana [fechaInicio, deadline]. 100% cliente: ninguna Cloud Function ni regla
 * lee el diario. Devuelve avance + estado; al profesor solo cruza el estado.
 *
 * El tipo canónico `RetoFinancieroTipo` vive en src/shared/types/tenancy.ts.
 */
import type { Movimiento } from '@features/savings/store/useMovimientosStore';
import type { SavingsGoal } from '@features/savings/store/useSavingsStore';
import type { SavingsOperation } from '@features/savings/domain/savings';
import type { RetoFinancieroTipo } from '@shared/types/tenancy';
import { dayKey, fechaDe } from '@features/savings/data/periodos';

export type { RetoFinancieroTipo };

export interface RetoConsigna {
  tipo: RetoFinancieroTipo;
  cantidad: number;
  fechaInicio: number;
  deadline: number;
}

export interface DiarioLocal {
  movimientos: Movimiento[];
  goals: SavingsGoal[];
  operations: SavingsOperation[];
}

export type RetoEstado = 'sin_empezar' | 'en_progreso' | 'cumplido';

function enVentana(epoch: number, reto: RetoConsigna): boolean {
  return epoch >= reto.fechaInicio && epoch <= reto.deadline;
}

function contarAvance(reto: RetoConsigna, diario: DiarioLocal): number {
  const movs = diario.movimientos.filter((m) => enVentana(fechaDe(m), reto));

  switch (reto.tipo) {
    case 'registrar_movimientos':
      return movs.filter((m) => m.tipo === 'gasto').length;
    case 'registrar_ahorros':
      return diario.operations.filter(
        (operation) => operation.type === 'aporte' && enVentana(operation.fecha, reto)
      ).length;
    case 'racha_dias':
      return new Set(movs.map((m) => dayKey(fechaDe(m)))).size;
    case 'crear_meta':
      return diario.goals.filter((g) => enVentana(g.createdAt, reto)).length;
    case 'abonar_meta':
      return diario.operations.filter(
        (operation) =>
          operation.type === 'aporte' && operation.goalId && enVentana(operation.fecha, reto)
      ).length;
    case 'cumplir_tope':
      // Diferido a v1 (sin UI de topes); el enum de rules aún no lo permite.
      return 0;
    default:
      // Forward-compat: un tipo desconocido no publica señal (RQ-PR14-CA8).
      return 0;
  }
}

export function evaluarReto(
  reto: RetoConsigna,
  diario: DiarioLocal,
  _now: number = Date.now()
): { estado: RetoEstado; avance: number } {
  const bruto = contarAvance(reto, diario);
  const estado: RetoEstado =
    bruto <= 0 ? 'sin_empezar' : bruto >= reto.cantidad ? 'cumplido' : 'en_progreso';
  return { estado, avance: Math.min(bruto, reto.cantidad) };
}
