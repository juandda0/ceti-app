import { parsearRegistroVoz } from '@features/savings/data/vozParser';
import {
  parseClientFinancialPlan,
  type FinancialContext,
  type FinancialPlan,
} from '@features/savings/assistant/financialPlan';
import { callFunction } from '@shared/lib/firebase/functions';
export type { ClasificacionMovimiento } from '@features/savings/data/vozParser';

export const VOZ_MAX_CHARS = 300;

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
  clasificarRegistroLocal: async (texto: string) =>
    parsearRegistroVoz(texto.slice(0, VOZ_MAX_CHARS)),
  planificar: async (
    texto: string,
    context: FinancialContext,
    requestId: string
  ): Promise<FinancialPlan> => {
    const rawText = texto.slice(0, VOZ_MAX_CHARS);
    const remoteText = truncateAtTokenBoundary(replaceGoalAliases(rawText, context));
    try {
      return parseClientFinancialPlan(
        await callFunction('planificarAccionesFinancieras', {
          text: remoteText,
          context,
          requestId,
        })
      );
    } catch (error) {
      const local = parsearRegistroVoz(rawText);
      if (local.some((item) => item.intencion === 'no_entendido')) throw error;
      const now = Date.now();
      return {
        source: 'local',
        actions: local.map((item, index) => ({
          actionId: `${requestId}:${index}`,
          domain: 'movimiento',
          operation: 'crear',
          payload: {
            tipo: item.tipo,
            monto: item.monto,
            descripcion: item.descripcion,
            categoria: item.categoria,
            fecha: now + item.offsetDias * 86_400_000,
          },
          needsInput: [],
        })),
      };
    }
  },
};
