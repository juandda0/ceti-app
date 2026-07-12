/**
 * Evalúa los retos del estudiante contra su diario LOCAL y publica solo las
 * transiciones hacia adelante (RQ-PR14). Cero lectura del diario por el
 * servidor: todo se computa aquí y solo cruza la señal {estado, timestamp}.
 * La decisión monotónica vive en retoSync.decidirEscritura (probada).
 */
import { useEffect, useRef } from 'react';
import { useMovimientosStore } from '@features/savings/store/useMovimientosStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import {
  decidirEscritura,
  type RetoAsignado,
  type RetoCoords,
  type RetoEstadoLocal,
} from '@features/dashboard/data/retoSync';

export function useRetoCompletionSync(retos: RetoAsignado[], coords: RetoCoords | null) {
  const movimientos = useMovimientosStore((s) => s.movimientos);
  const goals = useSavingsStore((s) => s.goals);
  const deposits = useSavingsStore((s) => s.deposits);
  // Caché en memoria del último estado publicado por reto — evita reescribir la
  // misma señal en cada render (el guard real vive en decidirEscritura).
  const publicado = useRef<Map<string, RetoEstadoLocal>>(new Map());

  useEffect(() => {
    if (!coords || retos.length === 0) return;
    const diario = { movimientos, goals, deposits };
    void (async () => {
      try {
        const { retoEstadoRepository } =
          await import('@features/dashboard/data/retoEstadoRepository');
        for (const reto of retos) {
          const prev = publicado.current.get(reto.id) ?? null;
          const estadoDoc = decidirEscritura(reto, diario, prev, coords);
          if (!estadoDoc) continue;
          const ok = await retoEstadoRepository.upsertEstado(
            coords.colegioId,
            coords.cursoId,
            coords.uid,
            reto.id,
            estadoDoc
          );
          if (ok) publicado.current.set(reto.id, estadoDoc.estado);
        }
      } catch (e) {
        void import('@shared/lib/analytics/crashlytics').then((m) =>
          m.recordError(e instanceof Error ? e : new Error(String(e)), 'reto_sync')
        );
      }
    })();
  }, [retos, coords, movimientos, goals, deposits]);
}
