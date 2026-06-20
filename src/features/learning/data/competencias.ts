/**
 * World ↔ CONPES 4005 competency mapping. This is the data link behind the
 * product's core selling point: the teacher sees "world = competency".
 *
 * IMPORTANT: the labels/domains below are **PROVISIONAL working values**. The
 * authoritative CONPES 4005 / MEN descriptors come from the curricular mapping
 * document (owner: product). Once that exists, refine `label`/`conpesDominio`
 * and fill `conpesCodigo` — but keep `id` stable, since it is persisted on every
 * `WorldProgress.competencia` and used in reports.
 */
import type { WorldId } from '@features/learning/data/quiz.types';

export interface Competencia {
  /** Stable id stored on WorldProgress.competencia and in reports. Do not rename. */
  id: string;
  /** Short human label shown in UI ("world = competency"). */
  label: string;
  /** CONPES 4005 / MEN domain (provisional). */
  conpesDominio: string;
  /** Official competency code from the curricular mapping doc (to be filled). */
  conpesCodigo?: string;
}

export const WORLD_COMPETENCIAS: Record<WorldId, Competencia> = {
  world_1: {
    id: 'ingreso',
    label: 'Ingreso y dinero',
    conpesDominio: 'Ingreso y manejo del dinero',
  },
  world_2: {
    id: 'presupuesto',
    label: 'Presupuesto',
    conpesDominio: 'Planeación y presupuesto',
  },
  world_3: {
    id: 'ahorro',
    label: 'Ahorro',
    conpesDominio: 'Ahorro',
  },
  world_4: {
    id: 'credito',
    label: 'Crédito',
    conpesDominio: 'Crédito y endeudamiento responsable',
  },
  world_5: {
    id: 'deuda',
    label: 'Deuda y riesgo',
    conpesDominio: 'Manejo de deudas y riesgo',
  },
};

export function competenciaForWorld(worldId: WorldId): Competencia {
  return WORLD_COMPETENCIAS[worldId];
}

const WORLD_ORDER: WorldId[] = ['world_1', 'world_2', 'world_3', 'world_4', 'world_5'];

/** Competencies in world order — the stable column set for reports/CSV. */
export const ALL_COMPETENCIAS: Competencia[] = WORLD_ORDER.map((w) => WORLD_COMPETENCIAS[w]);

export function competenciaLabel(id: string): string {
  return ALL_COMPETENCIAS.find((c) => c.id === id)?.label ?? id;
}
