/**
 * Mundo ↔ competencia de Ceti, y su alineación con las orientaciones del MEN
 * para la educación económica y financiera (Documento 26 de 2014, versión 4 de
 * 2022): los ámbitos conceptuales y las competencias (Decidir, Administrar,
 * Planear, Gestionar) que trabaja cada mundo. Es el dato detrás del panel y el
 * informe de cobertura de la entidad (Fase 6).
 *
 * - `id`: estable. Se guarda en cada `WorldProgress.competencia` y en los
 *   reportes. No se renombra.
 * - `label`: el nombre corto de Ceti en la app ("mundo = competencia").
 * - `men`: verificado contra el texto oficial; la alineación es lectura de Ceti
 *   (ver functions/src/educadores/dominio/normativa.ts).
 * - `conpesDominio`: agrupación de trabajo de Ceti, PROVISIONAL. El CONPES 4005
 *   es política pública y no trae un listado de competencias con códigos, así
 *   que `conpesCodigo` queda vacío a propósito: no inventarlo.
 */
import type { DefaultWorldId } from '@features/learning/data/quiz.types';
import { ALINEACION_MEN, type AlineacionMen } from '@/functions/src/educadores/dominio';

export interface Competencia {
  /** Stable id stored on WorldProgress.competencia and in reports. Do not rename. */
  id: string;
  /** Short human label shown in UI ("world = competency"). */
  label: string;
  /** Agrupación de trabajo de Ceti (PROVISIONAL; ver arriba). */
  conpesDominio: string;
  /** Sin código oficial: el CONPES 4005 no los define. */
  conpesCodigo?: string;
  /** Ámbitos y competencias de las orientaciones del MEN que trabaja este mundo. */
  men: AlineacionMen;
}

/** Competency id used when a custom world has no assigned CONPES competency. */
export const COMPETENCIA_PERSONALIZADA = 'personalizada';

export const WORLD_COMPETENCIAS: Record<DefaultWorldId, Competencia> = {
  world_1: {
    id: 'ingreso',
    men: ALINEACION_MEN.ingreso,
    label: 'Ingreso y dinero',
    conpesDominio: 'Ingreso y manejo del dinero',
  },
  world_2: {
    id: 'presupuesto',
    men: ALINEACION_MEN.presupuesto,
    label: 'Presupuesto',
    conpesDominio: 'Planeación y presupuesto',
  },
  world_3: {
    id: 'ahorro',
    men: ALINEACION_MEN.ahorro,
    label: 'Ahorro',
    conpesDominio: 'Ahorro',
  },
  world_4: {
    id: 'credito',
    men: ALINEACION_MEN.credito,
    label: 'Crédito',
    conpesDominio: 'Crédito y endeudamiento responsable',
  },
  world_5: {
    id: 'deuda',
    men: ALINEACION_MEN.deuda,
    label: 'Deuda y riesgo',
    conpesDominio: 'Manejo de deudas y riesgo',
  },
};

/** undefined for custom (`cw_*`) worlds — callers decide their fallback. */
export function competenciaForWorld(worldId: string): Competencia | undefined {
  return WORLD_COMPETENCIAS[worldId as DefaultWorldId];
}

/** Canonical (default) world order — the class config default (RQ-PR10). */
export const WORLD_ORDER: DefaultWorldId[] = [
  'world_1',
  'world_2',
  'world_3',
  'world_4',
  'world_5',
];

/** Competencies in world order — the stable column set for reports/CSV. */
export const ALL_COMPETENCIAS: Competencia[] = WORLD_ORDER.map((w) => WORLD_COMPETENCIAS[w]);

export function competenciaLabel(id: string): string {
  return ALL_COMPETENCIAS.find((c) => c.id === id)?.label ?? id;
}
