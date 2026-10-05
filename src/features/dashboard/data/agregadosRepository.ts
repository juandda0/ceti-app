import { api } from '@shared/lib/api/client';
import { cursoPath } from '@shared/lib/api/paths';

/**
 * Per-course aggregate, computed by the backend from the course's progress.
 * Contains ZERO nominal data — only counts and per-competency / per-world
 * averages (RQ-FN09). This is the profesor's colegio-wide reporting view
 * (D-PIVOT), so the school report is built from these aggregates (matriz §1.3).
 */

export interface CompetenciaAgregado {
  masteryPromedio: number;
  estudiantes: number;
  completados: number;
}

export interface MundoAgregado {
  masteryPromedio: number;
  estudiantes: number;
  completados: number;
}

export interface ResumenAgregado {
  colegioId: string;
  cursoId: string;
  porCompetencia: Record<string, CompetenciaAgregado>;
  porMundo: Record<string, MundoAgregado>;
  estudiantesActivos: number;
  masteryPromedio: number;
  porcentajeCompletado: number;
  /** Epoch ms; not consumed by the UI, kept for freshness/debug. */
  actualizadoAt?: number;
}

export const agregadosRepository = {
  /** The course's aggregate resumen, or null if none has been computed yet. */
  async getResumen(colegioId: string, cursoId: string): Promise<ResumenAgregado | null> {
    return api.getOrNull<ResumenAgregado>(`${cursoPath(colegioId, cursoId)}/agregado`);
  },
};
