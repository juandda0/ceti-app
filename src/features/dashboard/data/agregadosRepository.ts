import { getDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { agregadoDocRef } from '@shared/lib/firebase/paths';

/**
 * Per-course aggregate doc (`agregados/resumen`), written ONLY by the
 * onProgressWriteAggregate Cloud Function (Admin SDK). Contains ZERO nominal
 * data — only counts and per-competency / per-world averages (RQ-FN09). This is
 * the rector's ONLY data view: the rector is denied nominal progress by
 * firestore.rules and reads aggregates instead (matriz §1.3).
 */
export const AGREGADO_RESUMEN_ID = 'resumen';

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
  /** Firestore Timestamp; not consumed by the UI, kept for freshness/debug. */
  actualizadoAt?: unknown;
}

export const agregadosRepository = {
  /** The course's aggregate resumen, or null if none has been computed yet. */
  async getResumen(colegioId: string, cursoId: string): Promise<ResumenAgregado | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const snap = await getDoc(
      agregadoDocRef(clients.firestore, colegioId, cursoId, AGREGADO_RESUMEN_ID)
    );
    if (!snap.exists()) return null;
    return snap.data() as ResumenAgregado;
  },
};
