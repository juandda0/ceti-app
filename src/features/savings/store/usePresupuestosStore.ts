/**
 * Topes (presupuestos) por categoría del estudiante — self-view, en
 * users/{uid}/config/presupuestos (RQ-ES11-CA1). Local-first MMKV + sync
 * fire-and-forget. El tope es configuración del usuario, no un rasgo del menor
 * (R5). Analytics jamás recibe montos (CA9).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import { logEvent } from '@shared/lib/analytics/logEvent';
import type { MovimientoCategoria } from '@features/savings/store/useMovimientosStore';
import type { Presupuestos } from '@features/savings/data/presupuestos';

interface PresupuestosState {
  topes: Presupuestos;
}

interface PresupuestosActions {
  /** Fija un tope semanal; `null`/≤0 elimina la categoría del mapa. */
  setTope: (categoria: MovimientoCategoria, tope: number | null) => void;
  resetPresupuestos: () => void;
}

type PresupuestosStore = PresupuestosState & PresupuestosActions;

function sync(topes: Presupuestos) {
  void (async () => {
    try {
      const { useAuthStore } = await import('@features/auth/store/useAuthStore');
      const uid = useAuthStore.getState().firebaseUid;
      if (!uid) return;
      const { presupuestosRepository } =
        await import('@features/savings/data/presupuestosRepository');
      await presupuestosRepository.guardar(uid, topes);
    } catch (e) {
      void import('@shared/lib/analytics/crashlytics').then((m) =>
        m.recordError(e instanceof Error ? e : new Error(String(e)), 'presupuestos_sync')
      );
    }
  })();
}

export const usePresupuestosStore = create<PresupuestosStore>()(
  persist(
    (set, get) => ({
      topes: {},

      setTope: (categoria, tope) => {
        const topes = { ...get().topes };
        if (tope == null || tope <= 0) {
          delete topes[categoria];
        } else {
          topes[categoria] = tope;
          void logEvent('presupuesto_definido');
        }
        set({ topes });
        sync(topes);
      },

      resetPresupuestos: () => {
        set({ topes: {} });
        sync({});
      },
    }),
    {
      name: 'presupuestos-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
    }
  )
);
