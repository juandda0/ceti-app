/**
 * Precios de Ceti Educadores en pesos colombianos. Los planes individuales se
 * anuncian con IVA incluido (19 %); Nave y padrinazgo se cotizan + IVA. Puro.
 *
 * El IVA del 19 % se asume porque la exclusión del art. 476 E.T. para
 * plataformas educativas es dudosa (Oficio DIAN 362 de 2018). Confirmar con un
 * tributarista antes de facturar.
 */
import type { PlanIndividual } from './planes';

export const IVA = 0.19;

export const CICLOS = ['mensual', 'anioEscolar'] as const;
export type Ciclo = (typeof CICLOS)[number];

export function esCiclo(v: unknown): v is Ciclo {
  return typeof v === 'string' && (CICLOS as readonly string[]).includes(v);
}

/** Precio final (IVA incluido) por plan y ciclo. */
export const PRECIOS_COP: Record<PlanIndividual, Record<Ciclo, number>> = {
  piloto: { mensual: 24_900, anioEscolar: 199_000 },
  comandante: { mensual: 49_900, anioEscolar: 399_000 },
};

/** Tarifa fundador: los primeros cupos que pagan Piloto mensual la conservan mientras no cancelen. */
export const FUNDADOR = {
  cupos: 1_000,
  pilotoMensual: 19_900,
} as const;

/** Licencia institucional: por estudiante al año, + IVA. */
export const NAVE = {
  porEstudianteAnio: 35_000,
  minimoEstudiantes: 150,
  padrinoPorEstudianteAnio: 18_000,
} as const;

/** Meses que cubre cada ciclo. Año escolar = 12 meses, vacaciones incluidas. */
export const MESES_POR_CICLO: Record<Ciclo, number> = { mensual: 1, anioEscolar: 12 };

/** Días de prueba de Piloto al registrarse. */
export const DIAS_PRUEBA = 14;

export interface Desglose {
  total: number;
  base: number;
  iva: number;
}

/** Separa el IVA de un precio que ya lo incluye. */
export function desgloseIvaIncluido(total: number): Desglose {
  const base = Math.round(total / (1 + IVA));
  return { total, base, iva: total - base };
}

/** Suma el IVA a una base. */
export function conIva(base: number): Desglose {
  const iva = Math.round(base * IVA);
  return { total: base + iva, base, iva };
}

/** Precio final de un plan individual, aplicando la tarifa fundador si corresponde. */
export function precioPlan(plan: PlanIndividual, ciclo: Ciclo, fundador = false): number {
  if (fundador && plan === 'piloto' && ciclo === 'mensual') return FUNDADOR.pilotoMensual;
  return PRECIOS_COP[plan][ciclo];
}

/** Ahorro del Año escolar frente a 12 mensualidades, en porcentaje entero. */
export function ahorroAnioEscolar(plan: PlanIndividual): number {
  const p = PRECIOS_COP[plan];
  return Math.round((1 - p.anioEscolar / (p.mensual * 12)) * 100);
}

/** Cotización de Nave para un colegio (o de padrinazgo para colegios oficiales). */
export function cotizarNave(estudiantes: number, padrinazgo = false): Desglose & { estudiantes: number } {
  const n = Math.max(estudiantes, padrinazgo ? 1 : NAVE.minimoEstudiantes);
  const unitario = padrinazgo ? NAVE.padrinoPorEstudianteAnio : NAVE.porEstudianteAnio;
  return { ...conIva(n * unitario), estudiantes: n };
}

/** Formato '$24.900' (es-CO, sin decimales). */
export function formatoCop(valor: number): string {
  const entero = Math.round(valor).toString();
  return `$${entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
