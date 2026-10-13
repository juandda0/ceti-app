/**
 * Datos de la sección Gráficas. Puro y testeable: compone los helpers de
 * periodos/racha/ritmoMeta/projectSavings en vez de re-derivar fechas o totales.
 * Se recomputa en cada render y jamás se persiste (R5).
 *
 * Fuentes: los gastos viven en el diario (movimientos tipo 'gasto'); los ahorros
 * en las operaciones de metas (aporte − retiro). Movimientos legacy tipo 'ahorro'
 * se suman solo si no tienen ya una operación con su mismo id (el puente con
 * Metas crea el depósito con el id del movimiento), para no contar doble.
 */
import type { Movimiento, MovimientoCategoria } from '@features/savings/store/useMovimientosStore';
import type { SavingsGoal, SavingsOperation } from '@features/savings/domain/savings';
import { projectSavings } from '@features/savings/domain/savings';
import {
  dayKey,
  fechaDe,
  periodoAnterior,
  rangoPeriodo,
  totalesPorCategoriaEnRango,
  type Rango,
} from '@features/savings/data/periodos';
import { computeRacha } from '@features/savings/data/racha';
import { ritmoMeta } from '@features/savings/data/ritmoMeta';
import { goalStatus } from '@features/savings/data/goalStatus';

export type PeriodoGrafica = 'semana' | 'mes' | 'todo';

const DIA_MS = 24 * 60 * 60 * 1000;
const TODO: Rango = { desde: Number.NEGATIVE_INFINITY, hasta: Number.POSITIVE_INFINITY };
const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];
const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
/** Meses que muestra la serie de "Todo". */
export const MESES_SERIE_TODO = 6;

/** Un punto del flujo: gasto (positivo) o ahorro neto (aporte +, retiro −). */
export interface FlujoItem {
  tipo: 'gasto' | 'ahorro';
  monto: number;
  fecha: number;
}

function montoSeguro(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

export function construirFlujo(
  movimientos: Movimiento[],
  operations: SavingsOperation[]
): FlujoItem[] {
  const opIds = new Set(operations.map((o) => o.id));
  const out: FlujoItem[] = [];
  for (const m of movimientos) {
    if (m.tipo === 'ahorro' && opIds.has(m.id)) continue;
    out.push({ tipo: m.tipo, monto: montoSeguro(m.monto), fecha: fechaDe(m) });
  }
  for (const o of operations) {
    const signo = o.type === 'retiro' ? -1 : 1;
    out.push({ tipo: 'ahorro', monto: signo * montoSeguro(o.amount), fecha: o.fecha });
  }
  return out;
}

export function rangoDe(periodo: PeriodoGrafica, now: number = Date.now()): Rango {
  return periodo === 'todo' ? TODO : rangoPeriodo(periodo, now);
}

function enRango(f: number, r: Rango): boolean {
  return f >= r.desde && f <= r.hasta;
}

function sumar(flujo: FlujoItem[], r: Rango): { gastado: number; ahorrado: number } {
  let gastado = 0;
  let ahorrado = 0;
  for (const it of flujo) {
    if (!enRango(it.fecha, r)) continue;
    if (it.tipo === 'gasto') gastado += it.monto;
    else ahorrado += it.monto;
  }
  return { gastado, ahorrado };
}

export interface Resumen {
  gastado: number;
  ahorrado: number;
  balance: number;
  /** Gasto del periodo anterior del mismo tipo; null en "Todo". */
  gastadoAnterior: number | null;
}

export function resumenPeriodo(
  flujo: FlujoItem[],
  periodo: PeriodoGrafica,
  now: number = Date.now()
): Resumen {
  const { gastado, ahorrado } = sumar(flujo, rangoDe(periodo, now));
  const gastadoAnterior =
    periodo === 'todo' ? null : sumar(flujo, periodoAnterior(periodo, now)).gastado;
  return { gastado, ahorrado, balance: ahorrado - gastado, gastadoAnterior };
}

export interface CategoriaBarra {
  categoria: MovimientoCategoria;
  total: number;
  /** 0–100, redondeado. */
  pct: number;
}

export function gastosPorCategoria(
  movimientos: Movimiento[],
  periodo: PeriodoGrafica,
  now: number = Date.now()
): CategoriaBarra[] {
  const filas = totalesPorCategoriaEnRango(movimientos, 'gasto', rangoDe(periodo, now)).filter(
    (f) => f.total > 0
  );
  const total = filas.reduce((s, f) => s + f.total, 0);
  return filas.map((f) => ({
    ...f,
    pct: total > 0 ? Math.round((f.total / total) * 100) : 0,
  }));
}

export interface Columna {
  key: string;
  label: string;
  gastos: number;
  /** Ahorro neto del tramo, nunca negativo para dibujar. */
  ahorros: number;
  actual: boolean;
}

/**
 * Serie en el tiempo: Semana → 7 días (L–D); Mes → tramos de 7 días del mes;
 * Todo → últimos 6 meses. Usa dayKey (calendario Bogotá) para agrupar.
 */
export function serieTemporal(
  flujo: FlujoItem[],
  periodo: PeriodoGrafica,
  now: number = Date.now()
): Columna[] {
  const hoy = dayKey(now);
  let cols: Columna[];
  let indice: (f: number) => number;

  if (periodo === 'semana') {
    const { desde } = rangoPeriodo('semana', now);
    cols = DIAS_CORTOS.map((label, i) => ({
      key: dayKey(desde + i * DIA_MS + DIA_MS / 2),
      label,
      gastos: 0,
      ahorros: 0,
      actual: false,
    }));
    const pos = new Map(cols.map((c, i) => [c.key, i]));
    indice = (f) => pos.get(dayKey(f)) ?? -1;
    for (const c of cols) c.actual = c.key === hoy;
  } else if (periodo === 'mes') {
    const r = rangoPeriodo('mes', now);
    const ultimo = Number(dayKey(r.hasta).slice(8, 10));
    const n = Math.ceil(ultimo / 7);
    const diaHoy = Number(hoy.slice(8, 10));
    cols = Array.from({ length: n }, (_, i) => {
      const ini = i * 7 + 1;
      const fin = Math.min(ultimo, ini + 6);
      return {
        key: `t${i}`,
        label: `${ini}–${fin}`,
        gastos: 0,
        ahorros: 0,
        actual: diaHoy >= ini && diaHoy <= fin,
      };
    });
    indice = (f) => {
      if (!enRango(f, r)) return -1;
      const d = Number(dayKey(f).slice(8, 10));
      return Math.min(n - 1, Math.floor((d - 1) / 7));
    };
  } else {
    let y = Number(hoy.slice(0, 4));
    let m = Number(hoy.slice(5, 7)) - 1;
    const meses: { key: string; m: number }[] = [];
    for (let i = 0; i < MESES_SERIE_TODO; i++) {
      meses.unshift({ key: `${y}-${String(m + 1).padStart(2, '0')}`, m });
      m -= 1;
      if (m < 0) {
        m = 11;
        y -= 1;
      }
    }
    cols = meses.map((x, i) => ({
      key: x.key,
      label: MESES_CORTOS[x.m],
      gastos: 0,
      ahorros: 0,
      actual: i === meses.length - 1,
    }));
    const pos = new Map(cols.map((c, i) => [c.key, i]));
    indice = (f) => pos.get(dayKey(f).slice(0, 7)) ?? -1;
  }

  for (const it of flujo) {
    if (!Number.isFinite(it.fecha)) continue;
    const i = indice(it.fecha);
    if (i < 0) continue;
    if (it.tipo === 'gasto') cols[i].gastos += it.monto;
    else cols[i].ahorros += it.monto;
  }
  for (const c of cols) c.ahorros = Math.max(0, c.ahorros);
  return cols;
}

export interface MetaProgreso {
  id: string;
  title: string;
  target: number;
  actual: number;
  restante: number;
  /** 0–100 para la barra. */
  pct: number;
  cumplida: boolean;
  mesesAlRitmo: number | null;
}

/** Metas no borradas: activas primero (más avanzadas arriba), cumplidas al final. */
/** Lo mínimo de una meta: sirve tanto para la meta del store como la de dominio. */
export type MetaInput = Pick<SavingsGoal, 'id' | 'title' | 'targetAmount' | 'deletedAt'>;

export function progresoMetas(
  goals: MetaInput[],
  operations: SavingsOperation[],
  now: number = Date.now()
): MetaProgreso[] {
  const vivas: SavingsGoal[] = goals
    .filter((g) => !g.deletedAt)
    .map((g) => ({
      id: g.id,
      title: g.title,
      targetAmount: g.targetAmount,
      iconId: 'target',
      category: 'custom',
      createdAt: 0,
      updatedAt: 0,
    }));
  if (vivas.length === 0) return [];
  const { byGoal } = projectSavings(vivas, operations);
  return vivas
    .map((g) => {
      const target = Math.max(0, montoSeguro(g.targetAmount));
      const actual = Math.max(0, byGoal[g.id] ?? 0);
      const cumplida = goalStatus({ currentAmount: actual, targetAmount: target }) === 'cumplida';
      const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
      return {
        id: g.id,
        title: g.title,
        target,
        actual,
        restante: Math.max(0, target - actual),
        pct,
        cumplida,
        mesesAlRitmo: cumplida || target <= 0 ? null : ritmoMeta(g, operations, now).mesesAlRitmo,
      };
    })
    .sort((a, b) => Number(a.cumplida) - Number(b.cumplida) || b.pct - a.pct);
}

export interface Constancia {
  racha: number;
  /** 7 booleanos L–D de la semana actual: ¿registró algo ese día? */
  semana: boolean[];
  hoyIndex: number;
}

/** Racha + días con registro esta semana (gastos del diario y aportes/retiros). */
export function constancia(
  movimientos: Movimiento[],
  operations: SavingsOperation[],
  now: number = Date.now()
): Constancia {
  const comoMov: Movimiento[] = operations.map((o) => ({
    id: o.id,
    tipo: 'ahorro',
    monto: o.amount,
    descripcion: o.description,
    categoria: 'otros',
    origen: 'manual',
    createdAt: o.createdAt,
    fecha: o.fecha,
  }));
  const todos = [...movimientos, ...comoMov];
  const { dias } = computeRacha(todos, now);
  const conRegistro = new Set(todos.map((m) => dayKey(fechaDe(m))));
  const { desde } = rangoPeriodo('semana', now);
  const hoy = dayKey(now);
  let hoyIndex = 0;
  const semana = DIAS_CORTOS.map((_, i) => {
    const k = dayKey(desde + i * DIA_MS + DIA_MS / 2);
    if (k === hoy) hoyIndex = i;
    return conRegistro.has(k);
  });
  return { racha: dias, semana, hoyIndex };
}

export type InsightGrafica =
  | { key: 'menos'; pct: number }
  | { key: 'mas'; pct: number }
  | { key: 'igual' }
  | { key: 'ahorroPositivo' }
  | { key: 'gastoMayor' }
  | { key: 'soloAhorro' }
  | { key: 'arranque' }
  | { key: 'vacio' };

/** Una sola frase amigable para el encabezado, según el periodo. */
export function insightPeriodo(r: Resumen): InsightGrafica {
  if (r.gastado <= 0 && r.ahorrado <= 0) return { key: 'vacio' };
  if (r.gastado <= 0) return { key: 'soloAhorro' };
  if (r.gastadoAnterior != null) {
    if (r.gastadoAnterior <= 0) return { key: 'arranque' };
    const delta = (r.gastado - r.gastadoAnterior) / r.gastadoAnterior;
    const pct = Math.round(Math.abs(delta) * 100);
    if (pct < 5) return { key: 'igual' };
    return delta < 0 ? { key: 'menos', pct } : { key: 'mas', pct: Math.min(pct, 999) };
  }
  return r.balance >= 0 ? { key: 'ahorroPositivo' } : { key: 'gastoMayor' };
}

/** Tope "redondo" del eje y y sus marcas (0 incluido), p. ej. 0/25k/50k/75k. */
export function marcasEje(max: number, divisiones = 3): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const crudo = max / divisiones;
  const pot = Math.pow(10, Math.floor(Math.log10(crudo)));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * pot).find((p) => p >= crudo) ?? 10 * pot;
  return Array.from({ length: divisiones + 1 }, (_, i) => i * paso);
}
