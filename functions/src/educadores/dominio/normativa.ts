/**
 * Marco normativo de la educación económica y financiera (EEF) en Colombia y
 * cómo se alinean los mundos de Ceti con las orientaciones del MEN. Es la
 * evidencia que una entidad presenta en su PEI, a la Secretaría de Educación o
 * en una auditoría (panel e informe de cobertura, Fase 6). Puro.
 *
 * Fuente de las competencias, los ejes y los ámbitos: "Orientaciones
 * pedagógicas para la Educación Económica y Financiera. Perspectiva de gestión
 * del riesgo y recursos — Versión 4: 2022" (MEN y Asobancaria), que actualiza
 * el Documento 26 de 2014 ("Mi plan, mi vida y mi futuro"). Los nombres están
 * copiados del texto oficial (Tabla 5 y sección 3.1.1); no inventar otros.
 *
 * La alineación mundo → ámbitos es una lectura de Ceti sobre el contenido de
 * cada mundo, no un aval del MEN: el informe lo dice así.
 *
 * CONPES 4005 de 2020 es política pública (inclusión y EEF), no un listado de
 * competencias: por eso aquí no hay "códigos CONPES". Ninguna de estas normas
 * crea una asignatura obligatoria con sanción: los textos de venta no deben
 * decir que la hay.
 */

export interface Norma {
  id: string;
  nombre: string;
  /** Qué dice o qué hizo, en una línea y sin exagerar su alcance. */
  alcance: string;
  /** Nota de vigencia por confirmar (null = sin observaciones). */
  vigencia: string | null;
}

export const NORMAS_EEF: readonly Norma[] = [
  {
    id: 'ley1450',
    nombre: 'Ley 1450 de 2011, artículo 145',
    alcance:
      'Plan Nacional de Desarrollo 2010-2014: el MEN incluirá la educación económica y financiera en el diseño de programas para el desarrollo de competencias básicas.',
    vigencia: null,
  },
  {
    id: 'doc26',
    nombre: 'Documento 26 del MEN (2014), actualizado en 2022',
    alcance:
      'Orientaciones pedagógicas para la educación económica y financiera: competencias, ejes y ámbitos conceptuales por grupos de grados, como proyecto pedagógico transversal del PEI.',
    vigencia: null,
  },
  {
    id: 'decreto457',
    nombre: 'Decreto 457 de 2014',
    alcance:
      'Organizó el Sistema Administrativo Nacional para la Educación Económica y Financiera y creó su comisión intersectorial.',
    vigencia:
      'Fuentes secundarias indican que fue derogado por el Decreto 1517 de 2021; confirmar en el normograma oficial antes de citarlo como vigente.',
  },
  {
    id: 'conpes4005',
    nombre: 'CONPES 4005 de 2020',
    alcance: 'Política Nacional de Inclusión y Educación Económica y Financiera.',
    vigencia: null,
  },
];

/** Las cuatro competencias de la EEF (Orientaciones MEN, v4 2022, §3.1.1). */
export const COMPETENCIAS_MEN = ['decidir', 'administrar', 'planear', 'gestionar'] as const;
export type CompetenciaMen = (typeof COMPETENCIAS_MEN)[number];

export const NOMBRE_COMPETENCIA_MEN: Record<CompetenciaMen, string> = {
  decidir: 'Decidir',
  administrar: 'Administrar',
  planear: 'Planear',
  gestionar: 'Gestionar el riesgo',
};

export const EJES_MEN = ['economia', 'finanzas', 'riesgo'] as const;
export type EjeMen = (typeof EJES_MEN)[number];

export const NOMBRE_EJE_MEN: Record<EjeMen, string> = {
  economia: 'Economía',
  finanzas: 'Finanzas',
  riesgo: 'Gestión del riesgo',
};

/** Los 9 ámbitos conceptuales (Tabla 5), en el orden del documento. Ids estables. */
export const AMBITOS_MEN = [
  { id: 'contextoEconomico', eje: 'economia', nombre: 'Contextualización económica' },
  { id: 'desarrolloEconomico', eje: 'economia', nombre: 'Desarrollo económico' },
  { id: 'politicaEconomica', eje: 'economia', nombre: 'Política económica' },
  { id: 'contextoFinanciero', eje: 'finanzas', nombre: 'Contextualización financiera' },
  { id: 'presupuesto', eje: 'finanzas', nombre: 'Presupuesto' },
  { id: 'ahorroInversion', eje: 'finanzas', nombre: 'Ahorro e inversión' },
  { id: 'manejoDeudas', eje: 'finanzas', nombre: 'Manejo de deudas' },
  { id: 'sistemaFinanciero', eje: 'finanzas', nombre: 'Sistema financiero' },
  { id: 'analisisRiesgos', eje: 'riesgo', nombre: 'Análisis de riesgos' },
] as const satisfies readonly { id: string; eje: EjeMen; nombre: string }[];

export type AmbitoMen = (typeof AMBITOS_MEN)[number]['id'];

export function nombreAmbitoMen(id: AmbitoMen): string {
  return AMBITOS_MEN.find((a) => a.id === id)?.nombre ?? id;
}

/** Grupos de grados de las orientaciones (los de los Estándares Básicos de Competencias). */
export const GRUPOS_GRADO_MEN = ['1-3', '4-5', '6-7', '8-9', '10-11'] as const;
export type GrupoGradoMen = (typeof GRUPOS_GRADO_MEN)[number];

/** '10' → '10-11'. Un grado fuera de 1..11 (o un programa universitario) → null. */
export function grupoGradoMen(grado: string | null | undefined): GrupoGradoMen | null {
  const g = Number(grado);
  if (!Number.isInteger(g) || g < 1 || g > 11) return null;
  if (g <= 3) return '1-3';
  if (g <= 5) return '4-5';
  if (g <= 7) return '6-7';
  if (g <= 9) return '8-9';
  return '10-11';
}

export interface AlineacionMen {
  /** El ámbito al que apunta el mundo. */
  ambitos: readonly AmbitoMen[];
  competencias: readonly CompetenciaMen[];
}

/**
 * Lectura de Ceti: qué ámbitos y competencias de las orientaciones trabaja cada
 * competencia de Ceti (la clave es el `id` estable que se guarda en cada
 * registro de avance). Revisada contra los bancos de preguntas de cada mundo.
 */
export const ALINEACION_MEN: Readonly<Record<string, AlineacionMen>> = {
  // Mundo 1: qué es el dinero, fuentes de ingreso, necesidades y deseos, valor.
  ingreso: { ambitos: ['contextoFinanciero', 'contextoEconomico'], competencias: ['decidir'] },
  // Mundo 2: presupuesto personal, ingresos y egresos, 50/30/20, fondo de emergencia.
  presupuesto: { ambitos: ['presupuesto'], competencias: ['administrar', 'planear'] },
  // Mundo 3: metas de ahorro, interés compuesto, hábitos.
  ahorro: { ambitos: ['ahorroInversion'], competencias: ['planear'] },
  // Mundo 4: qué es el crédito, tasa de interés, capacidad de pago, tarjetas, historial.
  credito: { ambitos: ['manejoDeudas', 'sistemaFinanciero'], competencias: ['decidir'] },
  // Mundo 5: deuda manejable o riesgosa, sobreendeudamiento, riesgo, cómo salir.
  deuda: { ambitos: ['manejoDeudas', 'analisisRiesgos'], competencias: ['gestionar', 'administrar'] },
};

export function alineacionDe(competenciaId: string): AlineacionMen | null {
  return ALINEACION_MEN[competenciaId] ?? null;
}
