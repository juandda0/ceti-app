/**
 * Insights por reglas deterministas (RQ-ES11-CA3). Compone los módulos puros
 * (periodos/presupuestos/racha/ritmoMeta) en un catálogo fijo. Se recomputa en
 * cada render y JAMÁS se persiste ni llega a analytics con su contenido (R5):
 * no es un rasgo del menor, es una lectura efímera self-view. Cero ML.
 *
 * must-not-persist (R5): la salida de computeInsights nunca debe fluir a logEvent
 * ni a ningún *Repository.
 */
import type { Movimiento, MovimientoCategoria } from '@features/savings/store/useMovimientosStore';
import type { SavingsGoal, SavingsOperation } from '@features/savings/domain/savings';
import { projectSavings } from '@features/savings/domain/savings';
import {
  periodoAnterior,
  rangoPeriodo,
  totalesEnRango,
  totalesPorCategoriaEnRango,
} from '@features/savings/data/periodos';
import {
  estadoTope,
  gastoSemanalPorCategoria,
  semanasCumpliendoTopes,
  type Presupuestos,
} from '@features/savings/data/presupuestos';
import { computeRacha } from '@features/savings/data/racha';
import { ritmoMeta } from '@features/savings/data/ritmoMeta';

export type InsightId =
  | 'tope_excedido'
  | 'tope_cerca'
  | 'gasto_subio'
  | 'ritmo_meta'
  | 'racha'
  | 'semanas_cumpliendo'
  | 'mayor_categoria'
  | 'balance_positivo';

export interface Insight {
  id: InsightId;
  /** Menor = más importante; ordena y decide cuáles 2 se muestran. */
  prioridad: number;
  /** Clave i18n; el copy visible vive en es.json. */
  i18nKey: string;
  params?: Record<string, string | number>;
}

export interface InsightCtx {
  movimientos: Movimiento[];
  goals: SavingsGoal[];
  operations: SavingsOperation[];
  presupuestos: Presupuestos;
  now?: number;
}

// Umbrales del insight de subida de gasto. Cifras de producto (relevancia de UX),
// no valores económicos caducables (SMMLV/UVT), así que R14 no aplica.
const SUBIDA_PCT = 0.3;
const SUBIDA_MIN_COP = 5000;

export function computeInsights(ctx: InsightCtx, max = 2): Insight[] {
  const now = ctx.now ?? Date.now();
  const out: Insight[] = [];
  const topes = ctx.presupuestos;
  const gastoSem = gastoSemanalPorCategoria(ctx.movimientos, now);

  // Topes: el peor estado gana (excedido > cerca), un solo insight de tope.
  const excedidas: MovimientoCategoria[] = [];
  const cercas: MovimientoCategoria[] = [];
  for (const cat of Object.keys(topes) as MovimientoCategoria[]) {
    const tope = topes[cat];
    if (!tope || tope <= 0) continue;
    const est = estadoTope(gastoSem[cat] ?? 0, tope);
    if (est === 'excedido') excedidas.push(cat);
    else if (est === 'cerca') cercas.push(cat);
  }
  if (excedidas.length) {
    out.push({
      id: 'tope_excedido',
      prioridad: 1,
      i18nKey: 'insights.topeExcedido',
      params: { categoria: excedidas[0] },
    });
  } else if (cercas.length) {
    out.push({
      id: 'tope_cerca',
      prioridad: 2,
      i18nKey: 'insights.topeCerca',
      params: { categoria: cercas[0] },
    });
  }

  // Gasto semanal que sube vs la semana anterior (≥30% Y ≥$5.000).
  const gastoAct = totalesEnRango(ctx.movimientos, rangoPeriodo('semana', now)).gastos;
  const gastoAnt = totalesEnRango(ctx.movimientos, periodoAnterior('semana', now)).gastos;
  if (gastoAnt > 0) {
    const delta = gastoAct - gastoAnt;
    if (delta >= SUBIDA_MIN_COP && delta / gastoAnt >= SUBIDA_PCT) {
      out.push({
        id: 'gasto_subio',
        prioridad: 3,
        i18nKey: 'insights.gastoSubio',
        params: { pct: Math.round((delta / gastoAnt) * 100) },
      });
    }
  }

  // Ritmo de la primera meta activa con proyección.
  const projection = projectSavings(ctx.goals, ctx.operations);
  const metaActiva = ctx.goals.find(
    (goal) => !goal.deletedAt && (projection.byGoal[goal.id] ?? 0) < goal.targetAmount
  );
  if (metaActiva) {
    const { mesesAlRitmo } = ritmoMeta(metaActiva, ctx.operations, now);
    if (mesesAlRitmo && mesesAlRitmo > 0) {
      out.push({
        id: 'ritmo_meta',
        prioridad: 4,
        i18nKey: 'insights.ritmoMeta',
        params: { meses: mesesAlRitmo },
      });
    }
  }

  const { dias } = computeRacha(ctx.movimientos, now);
  if (dias >= 2) {
    out.push({ id: 'racha', prioridad: 5, i18nKey: 'insights.racha', params: { dias } });
  }

  const semanas = semanasCumpliendoTopes(ctx.movimientos, topes, 8, now);
  if (semanas >= 1) {
    out.push({
      id: 'semanas_cumpliendo',
      prioridad: 6,
      i18nKey: 'insights.semanasCumpliendo',
      params: { semanas },
    });
  }

  const porCat = totalesPorCategoriaEnRango(ctx.movimientos, 'gasto', rangoPeriodo('mes', now));
  if (porCat.length) {
    out.push({
      id: 'mayor_categoria',
      prioridad: 7,
      i18nKey: 'insights.mayorCategoria',
      params: { categoria: porCat[0].categoria },
    });
  }

  return out.sort((a, b) => a.prioridad - b.prioridad).slice(0, max);
}
