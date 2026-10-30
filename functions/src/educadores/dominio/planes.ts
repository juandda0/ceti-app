/**
 * Planes de Ceti Educadores y lo que permite cada uno. Fuente única para el
 * servidor (Cloud Functions hace cumplir los límites) y para la app (muestra el
 * muro y la comparación). Puro: sin Firebase.
 *
 * Regla de producto: el muro nunca está en enseñar. Con Cadete (gratis) un profe
 * crea una clase, une estudiantes por código, usa los mundos de Ceti, asigna y
 * ve el avance. Se paga por hacer más y ahorrar tiempo.
 *
 * Contrato A (docs/contratos/educadores-orbita.md): el plan del profe nunca le
 * quita nada a la experiencia del estudiante.
 */

export const PLAN_IDS = ['cadete', 'piloto', 'comandante', 'nave'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export function esPlanId(v: unknown): v is PlanId {
  return typeof v === 'string' && (PLAN_IDS as readonly string[]).includes(v);
}

/** Planes que un profe puede comprar por su cuenta (Nave se contrata como colegio). */
export const PLANES_INDIVIDUALES = ['piloto', 'comandante'] as const;
export type PlanIndividual = (typeof PLANES_INDIVIDUALES)[number];

export function esPlanIndividual(v: unknown): v is PlanIndividual {
  return typeof v === 'string' && (PLANES_INDIVIDUALES as readonly string[]).includes(v);
}

/** Herramientas del profe que dependen del plan. */
export const FUNCIONES = [
  'editarContenido',
  'mundosPropios',
  'iaAuthoring',
  'alertasTempranas',
  'competenciaDebil',
  'notasPeriodo',
  'exportarCsv',
  'configurarMundos',
  'bibliotecaPublicar',
  'aulasConMarca',
  'panelCapitan',
  'prePostTest',
  'fichaCompleta',
  'analisisClase',
  'mensajesProfe',
  'resumenAcudientes',
  'informeCobertura',
  'certificados',
  'rubricas',
] as const;
export type Funcion = (typeof FUNCIONES)[number];

export interface LimitesPlan {
  /** Clases activas que puede tener el profe. */
  clases: number;
  /** Estudiantes por clase. */
  estudiantesPorClase: number;
  /** Generaciones de IA al mes (borradores de mundo + ítems sueltos). */
  iaGeneracionesMes: number;
  /** Clases en vivo que puede abrir al mes (Fase 8). */
  clasesVivoMes: number;
}

export interface DefinicionPlan {
  id: PlanId;
  /** Orden de valor, para comparar planes (mayor = más completo). */
  rango: number;
  limites: LimitesPlan;
  funciones: readonly Funcion[];
}

const ILIMITADO = Number.POSITIVE_INFINITY;

const FUNCIONES_PILOTO: readonly Funcion[] = [
  'editarContenido',
  'mundosPropios',
  'iaAuthoring',
  'alertasTempranas',
  'competenciaDebil',
  'notasPeriodo',
  'exportarCsv',
  'configurarMundos',
  // Ficha del estudiante con todo su historial (Cadete ve los últimos 7 días).
  'fichaCompleta',
  // Análisis de la clase: mapa de calor, preguntas, actividad y tareas.
  'analisisClase',
  // Mensajes a un estudiante o a un grupo y comentarios en la ficha (Fase 5).
  // Los anuncios a toda la clase son de todos los planes.
  'mensajesProfe',
  // Fase 7: el informe de cobertura de la EEF de su propia clase, la puerta
  // de entrada al plan Colegio (el de toda la institución es de la entidad).
  'informeCobertura',
  // Fase 8: certificados de participación con código de verificación.
  'certificados',
  // Fase 9: tareas abiertas con rúbrica (calificarlas es de cualquier plan).
  'rubricas',
];

export const PLANES: Record<PlanId, DefinicionPlan> = {
  cadete: {
    id: 'cadete',
    rango: 0,
    limites: { clases: 1, estudiantesPorClase: 45, iaGeneracionesMes: 0, clasesVivoMes: 3 },
    funciones: [],
  },
  piloto: {
    id: 'piloto',
    rango: 1,
    limites: { clases: ILIMITADO, estudiantesPorClase: 60, iaGeneracionesMes: 60, clasesVivoMes: ILIMITADO },
    funciones: FUNCIONES_PILOTO,
  },
  comandante: {
    id: 'comandante',
    rango: 2,
    limites: { clases: ILIMITADO, estudiantesPorClase: 60, iaGeneracionesMes: 300, clasesVivoMes: ILIMITADO },
    // El resumen para acudientes es el gancho del tutor (Fase 5).
    funciones: [...FUNCIONES_PILOTO, 'bibliotecaPublicar', 'aulasConMarca', 'resumenAcudientes'],
  },
  nave: {
    id: 'nave',
    rango: 3,
    limites: { clases: ILIMITADO, estudiantesPorClase: 60, iaGeneracionesMes: 120, clasesVivoMes: ILIMITADO },
    // Fase 8: los profes de un colegio también publican en la biblioteca pública.
    funciones: [...FUNCIONES_PILOTO, 'panelCapitan', 'prePostTest', 'resumenAcudientes', 'bibliotecaPublicar'],
  },
};

/** ¿El plan incluye esta herramienta? */
export function puede(plan: PlanId, funcion: Funcion): boolean {
  return PLANES[plan].funciones.includes(funcion);
}

export function limites(plan: PlanId): LimitesPlan {
  return PLANES[plan].limites;
}

/** ¿Puede crear otra clase teniendo ya `clasesActuales`? */
export function puedeCrearClase(plan: PlanId, clasesActuales: number): boolean {
  return clasesActuales < PLANES[plan].limites.clases;
}

/** ¿Cabe otro estudiante en una clase que ya tiene `estudiantesActuales`? */
export function cabeEstudiante(plan: PlanId, estudiantesActuales: number): boolean {
  return estudiantesActuales < PLANES[plan].limites.estudiantesPorClase;
}

/** Generaciones de IA que le quedan este mes. */
export function iaRestante(plan: PlanId, usadasEsteMes: number): number {
  return Math.max(0, PLANES[plan].limites.iaGeneracionesMes - usadasEsteMes);
}

/**
 * Clases que se pueden editar cuando el plan baja (por ejemplo, al cancelar).
 * Nada se borra: las clases que sobran quedan en solo lectura (E8). Se conservan
 * editables las más recientes. Devuelve los ids editables.
 */
export function clasesEditables(
  plan: PlanId,
  clases: readonly { id: string; creadaAt: number }[]
): Set<string> {
  const max = PLANES[plan].limites.clases;
  const ordenadas = [...clases].sort((a, b) => b.creadaAt - a.creadaAt);
  return new Set(ordenadas.slice(0, max === ILIMITADO ? ordenadas.length : max).map((c) => c.id));
}

/** El plan más barato que incluye la herramienta (para el texto del muro). */
export function planMinimoPara(funcion: Funcion): PlanId {
  const plan = PLAN_IDS.map((id) => PLANES[id])
    .filter((p) => p.id !== 'nave' || funcion === 'panelCapitan' || funcion === 'prePostTest')
    .sort((a, b) => a.rango - b.rango)
    .find((p) => p.funciones.includes(funcion));
  return plan?.id ?? 'piloto';
}

/** El mejor de dos planes (p. ej. el individual frente a la licencia del colegio). */
export function mejorPlan(a: PlanId, b: PlanId): PlanId {
  return PLANES[a].rango >= PLANES[b].rango ? a : b;
}
