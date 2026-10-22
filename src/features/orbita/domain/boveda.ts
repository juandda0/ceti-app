/**
 * La Bóveda de Ceti: dónde viven los Cetis.
 *
 * - Bolsillo: lo que ganas cae aquí. No rinde.
 * - Bóveda: paga TASA_BOVEDA de interés compuesto cada lunes, sobre lo que haya
 *   hasta TOPE_INTERES. Se puede sacar cuando quieras (liquidez).
 * - CDT orbital: bloquea Cetis de la Bóveda 2, 4 u 8 semanas a una tasa mayor.
 *   Al vencer vuelve solo a la Bóveda con su interés. Romperlo antes devuelve
 *   solo lo que pusiste.
 *
 * Puro. Los montos son enteros.
 */
import { diasEntre, lunesDe, sumarDias } from './tiempo';

export const TASA_BOVEDA = 0.03;
export const TOPE_INTERES = 2000;
export const PLAZOS_CDT = [2, 4, 8] as const;
export type PlazoCdt = (typeof PLAZOS_CDT)[number];
/** Interés total del CDT al vencer, por plazo en semanas. */
export const TASAS_CDT: Record<PlazoCdt, number> = { 2: 0.07, 4: 0.15, 8: 0.35 };
export const MAX_CDTS = 3;
export const MIN_CDT = 50;
export const MAX_MONTO_CDT = 2000;

export interface Cdt {
  id: string;
  monto: number;
  semanas: PlazoCdt;
  inicio: string;
  vence: string;
}

export interface EstadoBoveda {
  bolsillo: number;
  boveda: number;
  cdts: Cdt[];
  /** Último lunes en que se liquidó el interés. */
  ultimoLunes?: string;
  /** Interés del último pago, para mostrarlo ("+36 hoy"). */
  ultimoPago?: { lunes: string; monto: number };
  /** Total de interés ganado en la vida (incluye CDT). */
  interesTotal: number;
}

export const BOVEDA_INICIAL: EstadoBoveda = { bolsillo: 0, boveda: 0, cdts: [], interesTotal: 0 };

export type ErrorBoveda = 'monto_invalido' | 'sin_fondos' | 'tope_cdts' | 'no_existe';
export type Resultado = { ok: true; estado: EstadoBoveda } | { ok: false; error: ErrorBoveda };

export function interesSemana(boveda: number): number {
  return Math.round(Math.min(boveda, TOPE_INTERES) * TASA_BOVEDA);
}

export function pagoCdt(cdt: Pick<Cdt, 'monto' | 'semanas'>): number {
  return Math.round(cdt.monto * (1 + TASAS_CDT[cdt.semanas]));
}

export interface Liquidacion {
  estado: EstadoBoveda;
  interes: number;
  cdtsVencidos: Cdt[];
}

/** Paga los lunes pendientes y cobra los CDT vencidos. Idempotente. */
export function liquidar(e: EstadoBoveda, hoy: string): Liquidacion {
  const lunes = lunesDe(hoy);
  let estado = e;
  let interes = 0;
  if (!estado.ultimoLunes) {
    estado = { ...estado, ultimoLunes: lunes };
  } else {
    const semanas = Math.max(0, Math.floor(diasEntre(estado.ultimoLunes, lunes) / 7));
    let boveda = estado.boveda;
    for (let i = 0; i < semanas; i++) {
      const pago = interesSemana(boveda);
      boveda += pago;
      interes += pago;
    }
    estado = {
      ...estado,
      boveda,
      ultimoLunes: lunes,
      interesTotal: estado.interesTotal + interes,
      ...(interes > 0 ? { ultimoPago: { lunes, monto: interes } } : {}),
    };
  }

  const cdtsVencidos = estado.cdts.filter((c) => c.vence <= hoy);
  if (cdtsVencidos.length > 0) {
    const cobro = cdtsVencidos.reduce((s, c) => s + pagoCdt(c), 0);
    const ganado = cdtsVencidos.reduce((s, c) => s + pagoCdt(c) - c.monto, 0);
    estado = {
      ...estado,
      boveda: estado.boveda + cobro,
      cdts: estado.cdts.filter((c) => c.vence > hoy),
      interesTotal: estado.interesTotal + ganado,
    };
  }
  return { estado, interes, cdtsVencidos };
}

function montoValido(monto: number): boolean {
  return Number.isInteger(monto) && monto > 0;
}

export function ganar(e: EstadoBoveda, monto: number): EstadoBoveda {
  return monto > 0 ? { ...e, bolsillo: e.bolsillo + Math.round(monto) } : e;
}

export function gastar(e: EstadoBoveda, monto: number): Resultado {
  if (!montoValido(monto)) return { ok: false, error: 'monto_invalido' };
  if (monto > e.bolsillo) return { ok: false, error: 'sin_fondos' };
  return { ok: true, estado: { ...e, bolsillo: e.bolsillo - monto } };
}

export function depositar(e: EstadoBoveda, monto: number): Resultado {
  if (!montoValido(monto)) return { ok: false, error: 'monto_invalido' };
  if (monto > e.bolsillo) return { ok: false, error: 'sin_fondos' };
  return { ok: true, estado: { ...e, bolsillo: e.bolsillo - monto, boveda: e.boveda + monto } };
}

export function retirar(e: EstadoBoveda, monto: number): Resultado {
  if (!montoValido(monto)) return { ok: false, error: 'monto_invalido' };
  if (monto > e.boveda) return { ok: false, error: 'sin_fondos' };
  return { ok: true, estado: { ...e, bolsillo: e.bolsillo + monto, boveda: e.boveda - monto } };
}

export function abrirCdt(
  e: EstadoBoveda,
  monto: number,
  semanas: PlazoCdt,
  hoy: string,
  id: string
): Resultado {
  if (!montoValido(monto) || monto < MIN_CDT || monto > MAX_MONTO_CDT) {
    return { ok: false, error: 'monto_invalido' };
  }
  if (e.cdts.length >= MAX_CDTS) return { ok: false, error: 'tope_cdts' };
  if (monto > e.boveda) return { ok: false, error: 'sin_fondos' };
  const cdt: Cdt = { id, monto, semanas, inicio: hoy, vence: sumarDias(hoy, semanas * 7) };
  return { ok: true, estado: { ...e, boveda: e.boveda - monto, cdts: [...e.cdts, cdt] } };
}

/** Rompe un CDT antes de tiempo: vuelve a la Bóveda solo el monto puesto. */
export function romperCdt(e: EstadoBoveda, id: string): Resultado {
  const cdt = e.cdts.find((c) => c.id === id);
  if (!cdt) return { ok: false, error: 'no_existe' };
  return {
    ok: true,
    estado: { ...e, boveda: e.boveda + cdt.monto, cdts: e.cdts.filter((c) => c.id !== id) },
  };
}

export function totalCetis(e: EstadoBoveda): number {
  return e.bolsillo + e.boveda + e.cdts.reduce((s, c) => s + c.monto, 0);
}

/** Simulación para la pantalla: saldo de `monto` tras `semanas` en la Bóveda. */
export function proyectar(monto: number, semanas: number): number {
  let saldo = monto;
  for (let i = 0; i < semanas; i++) saldo += interesSemana(saldo);
  return saldo;
}
