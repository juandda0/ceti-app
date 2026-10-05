import {
  parseClientFinancialPlan,
  type FinancialContext,
  type FinancialPlan,
} from '@features/savings/assistant/financialPlan';
import type {
  MovimientoCategoria,
  MovimientoIntencion,
  MovimientoTipo,
} from '@features/savings/store/useMovimientosStore';
import { callFunction } from '@shared/lib/firebase/functions';

export const VOZ_MAX_CHARS = 300;

export interface ClasificacionMovimiento {
  intencion: MovimientoIntencion;
  tipo: MovimientoTipo;
  monto: number;
  descripcion: string;
  categoria: MovimientoCategoria;
  confianza: number;
  offsetDias: number;
  diaSemana?: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceGoalAliases(text: string, context: FinancialContext): string {
  return [...context.goals]
    .sort((a, b) => b.title.length - a.title.length)
    .reduce(
      (current, goal) =>
        current.replace(
          new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegex(goal.title)}(?=$|[^\\p{L}\\p{N}_])`, 'giu'),
          (_, prefix: string) => `${prefix}${goal.id}`
        ),
      text
    );
}

function truncateAtTokenBoundary(text: string): string {
  if (text.length <= VOZ_MAX_CHARS) return text;
  const candidate = text.slice(0, VOZ_MAX_CHARS);
  const boundary = candidate.search(/\s+\S*$/u);
  return boundary > 0 ? candidate.slice(0, boundary) : '';
}

export const vozService = {
  planificar: async (
    texto: string,
    context: FinancialContext,
    requestId: string
  ): Promise<FinancialPlan> => {
    const rawText = texto.slice(0, VOZ_MAX_CHARS);
    const remoteText = truncateAtTokenBoundary(replaceGoalAliases(rawText, context));
    return parseClientFinancialPlan(
      await callFunction('planificarAccionesFinancieras', {
        text: remoteText,
        context,
        requestId,
      })
    );
  },
};
