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

export const CICLOS = ['mensual', 'semestral', 'anioEscolar'] as const;
export type Ciclo = (typeof CICLOS)[number];

export function esCiclo(v: unknown): v is Ciclo {
  return typeof v === 'string' && (CICLOS as readonly string[]).includes(v);
}

/** Precio final (IVA incluido) por plan y ciclo. */
export const PRECIOS_COP: Record<PlanIndividual, Record<Ciclo, number>> = {
  piloto: { mensual: 24_900, semestral: 129_000, anioEscolar: 199_000 },
  comandante: { mensual: 49_900, semestral: 259_000, anioEscolar: 399_000 },
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
export const MESES_POR_CICLO: Record<Ciclo, number> = { mensual: 1, semestral: 6, anioEscolar: 12 };

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

/** Ahorro de un ciclo frente a pagar mes a mes, en porcentaje entero. */
export function ahorroCiclo(plan: PlanIndividual, ciclo: Ciclo): number {
  const p = PRECIOS_COP[plan];
  return Math.round((1 - p[ciclo] / (p.mensual * MESES_POR_CICLO[ciclo])) * 100);
}

/** Ahorro del Año escolar frente a 12 mensualidades, en porcentaje entero. */
export function ahorroAnioEscolar(plan: PlanIndividual): number {
  return ahorroCiclo(plan, 'anioEscolar');
}

/** Cotización de Nave para un colegio (o de padrinazgo para colegios oficiales). */
export function cotizarNave(estudiantes: number, padrinazgo = false): Desglose & { estudiantes: number } {
  const n = Math.max(estudiantes, padrinazgo ? 1 : NAVE.minimoEstudiantes);
  const unitario = padrinazgo ? NAVE.padrinoPorEstudianteAnio : NAVE.porEstudianteAnio;
  return { ...conIva(n * unitario), estudiantes: n };
}

// ---------------------------------------------------------------------------
// Planes de entidad (Fase 6): colegios, universidades y academias. Se cotizan
// + IVA y se facturan a la entidad, por semestre o por año. Los precios de
// Equipo y Universidad son propuesta del 30-oct-2026: se cambian solo aquí.
// ---------------------------------------------------------------------------

export const PLANES_ENTIDAD = ['equipo', 'colegio', 'universidad'] as const;
export type PlanEntidad = (typeof PLANES_ENTIDAD)[number];

export function esPlanEntidad(v: unknown): v is PlanEntidad {
  return typeof v === 'string' && (PLANES_ENTIDAD as readonly string[]).includes(v);
}

export const CICLOS_ENTIDAD = ['semestral', 'anual'] as const;
export type CicloEntidad = (typeof CICLOS_ENTIDAD)[number];

export function esCicloEntidad(v: unknown): v is CicloEntidad {
  return typeof v === 'string' && (CICLOS_ENTIDAD as readonly string[]).includes(v);
}

export const MESES_CICLO_ENTIDAD: Record<CicloEntidad, number> = { semestral: 6, anual: 12 };

/** Equipo: academias, centros de tutoría, fundaciones o un departamento. */
export const EQUIPO = { porProfeMes: 21_900, minimoProfes: 3 } as const;
/** Universidad: por estudiante que entró al menos una vez en el semestre. */
export const UNIVERSIDAD = { porEstudianteActivoSemestre: 19_000, minimoEstudiantes: 300 } as const;

/** Qué se cuenta en cada plan de entidad. */
export type UnidadEntidad = 'profe' | 'estudiante' | 'estudianteActivo';

export const UNIDAD_ENTIDAD: Record<PlanEntidad, UnidadEntidad> = {
  equipo: 'profe',
  colegio: 'estudiante',
  universidad: 'estudianteActivo',
};

export function minimoEntidad(plan: PlanEntidad, padrinazgo = false): number {
  if (plan === 'equipo') return EQUIPO.minimoProfes;
  if (plan === 'universidad') return UNIVERSIDAD.minimoEstudiantes;
  return padrinazgo ? 1 : NAVE.minimoEstudiantes;
}

/** Precio por unidad para todo el ciclo, + IVA. */
export function unitarioEntidad(plan: PlanEntidad, ciclo: CicloEntidad, padrinazgo = false): number {
  const meses = MESES_CICLO_ENTIDAD[ciclo];
  if (plan === 'equipo') return EQUIPO.porProfeMes * meses;
  if (plan === 'universidad') return UNIVERSIDAD.porEstudianteActivoSemestre * (meses / 6);
  const anual = padrinazgo ? NAVE.padrinoPorEstudianteAnio : NAVE.porEstudianteAnio;
  return Math.round((anual * meses) / 12);
}

export interface CotizacionEntidad extends Desglose {
  plan: PlanEntidad;
  ciclo: CicloEntidad;
  unidad: UnidadEntidad;
  /** Cantidad cobrada (ya con el mínimo). */
  cantidad: number;
  /** Lo que pidió la entidad, antes del mínimo. */
  solicitada: number;
  unitario: number;
  meses: number;
  padrinazgo: boolean;
}

/** Cotización de un plan de entidad: unidades (con el mínimo) × unitario del ciclo, + IVA. */
export function cotizarEntidad(
  plan: PlanEntidad,
  ciclo: CicloEntidad,
  solicitada: number,
  padrinazgo = false
): CotizacionEntidad {
  const pedida = Math.max(0, Math.floor(Number.isFinite(solicitada) ? solicitada : 0));
  const cantidad = Math.max(pedida, minimoEntidad(plan, padrinazgo));
  const unitario = unitarioEntidad(plan, ciclo, padrinazgo && plan === 'colegio');
  return {
    ...conIva(cantidad * unitario),
    plan,
    ciclo,
    unidad: UNIDAD_ENTIDAD[plan],
    cantidad,
    solicitada: pedida,
    unitario,
    meses: MESES_CICLO_ENTIDAD[ciclo],
    padrinazgo: padrinazgo && plan === 'colegio',
  };
}

/** Formato '$24.900' (es-CO, sin decimales). */
export function formatoCop(valor: number): string {
  const entero = Math.round(valor).toString();
  return `$${entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
