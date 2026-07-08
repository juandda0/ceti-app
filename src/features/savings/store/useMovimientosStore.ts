/**
 * Pocket-money diary (RQ-ES10): REAL self-declared movements, local-first with
 * fire-and-forget sync to users/{uid}/movimientos (isSelf, self-only — CA5).
 * Analytics never receives montos/descripciones/categorías (CA6).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import { logEvent } from '@shared/lib/analytics/logEvent';

export type MovimientoTipo = 'ahorro' | 'gasto';

export const MOVIMIENTO_CATEGORIAS = [
  'comida',
  'transporte',
  'entretenimiento',
  'ropa',
  'educacion',
  'tecnologia',
  'regalos',
  'otros',
] as const;

export type MovimientoCategoria = (typeof MOVIMIENTO_CATEGORIAS)[number];

export type MovimientoOrigen = 'voz' | 'manual';

export interface Movimiento {
  id: string;
  tipo: MovimientoTipo;
  monto: number;
  descripcion: string;
  categoria: MovimientoCategoria;
  origen: MovimientoOrigen;
  goalId?: string;
  createdAt: number;
}

interface MovimientosState {
  movimientos: Movimiento[];
}

interface MovimientosActions {
  addMovimiento: (data: Omit<Movimiento, 'id' | 'createdAt'>) => Movimiento;
  removeMovimiento: (movimientoId: string) => void;
  resetMovimientos: () => void;
}

type MovimientosStore = MovimientosState & MovimientosActions;

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const useMovimientosStore = create<MovimientosStore>()(
  persist(
    (set) => ({
      movimientos: [],

      addMovimiento: (data) => {
        const movimiento: Movimiento = {
          ...data,
          id: `mov_${uid()}`,
          createdAt: Date.now(),
        };
        set((s) => ({ movimientos: [...s.movimientos, movimiento] }));
        void logEvent('movimiento_registrado', { origen: data.origen, tipo: data.tipo });

        void (async () => {
          try {
            const { useAuthStore } = await import('@features/auth/store/useAuthStore');
            const authUid = useAuthStore.getState().firebaseUid;
            if (!authUid) return;
            const { movimientosRepository } =
              await import('@features/savings/data/movimientosRepository');
            await movimientosRepository.upsertMovimiento(authUid, movimiento);
          } catch (e) {
            void import('@shared/lib/analytics/crashlytics').then((m) =>
              m.recordError(e instanceof Error ? e : new Error(String(e)), 'movimientos_add')
            );
          }
        })();

        // Puente con Metas (D-ES10-04): un ahorro dirigido a una meta reusa el
        // circuito de deposits para que el progreso de la meta siga vivo.
        if (movimiento.tipo === 'ahorro' && movimiento.goalId) {
          void (async () => {
            const { useSavingsStore } = await import('@features/savings/store/useSavingsStore');
            useSavingsStore
              .getState()
              .addDeposit(movimiento.monto, movimiento.descripcion, movimiento.goalId);
          })();
        }

        return movimiento;
      },

      removeMovimiento: (movimientoId) => {
        set((s) => ({ movimientos: s.movimientos.filter((m) => m.id !== movimientoId) }));
        void (async () => {
          try {
            const { useAuthStore } = await import('@features/auth/store/useAuthStore');
            const authUid = useAuthStore.getState().firebaseUid;
            if (!authUid) return;
            const { movimientosRepository } =
              await import('@features/savings/data/movimientosRepository');
            await movimientosRepository.removeMovimiento(authUid, movimientoId);
          } catch (e) {
            void import('@shared/lib/analytics/crashlytics').then((m) =>
              m.recordError(e instanceof Error ? e : new Error(String(e)), 'movimientos_remove')
            );
          }
        })();
      },

      resetMovimientos: () => set({ movimientos: [] }),
    }),
    {
      name: 'movimientos-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
    }
  )
);
