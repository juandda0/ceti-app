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

// Intención de voz detectada por palabra clave (RQ-ES10 D-ES10-06): registrar un
// gasto/ahorro, abonar a una meta existente, o crear una meta nueva.
// `no_entendido`: la IA filtró la frase (off-topic o inapropiada) → "no te entendí".
export type MovimientoIntencion = 'movimiento' | 'abonar_meta' | 'crear_meta' | 'no_entendido';

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
  // Fecha declarada del movimiento (epoch ms), p. ej. "ayer gasté…". Opcional y
  // aditivo (RQ-ES11-CA7): los docs viejos no se migran, toda lectura usa
  // `fecha ?? createdAt`. El transporte offsetDias/diaSemana nunca se persiste.
  fecha?: number;
  updatedAt?: number;
}

export function isExpenseSnapshot(value: unknown): value is Movimiento {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    Object.keys(item).every((key) =>
      [
        'id',
        'tipo',
        'monto',
        'descripcion',
        'categoria',
        'origen',
        'fecha',
        'createdAt',
        'updatedAt',
      ].includes(key)
    ) &&
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    item.tipo === 'gasto' &&
    Number.isInteger(item.monto) &&
    Number(item.monto) > 0 &&
    Number(item.monto) <= 100_000_000 &&
    typeof item.descripcion === 'string' &&
    item.descripcion.length <= 140 &&
    typeof item.categoria === 'string' &&
    MOVIMIENTO_CATEGORIAS.includes(item.categoria as MovimientoCategoria) &&
    (item.origen === 'voz' || item.origen === 'manual') &&
    typeof item.fecha === 'number' &&
    Number.isFinite(item.fecha) &&
    typeof item.createdAt === 'number' &&
    Number.isFinite(item.createdAt) &&
    typeof item.updatedAt === 'number' &&
    Number.isFinite(item.updatedAt)
  );
}

interface MovimientosState {
  movimientos: Movimiento[];
}

interface MovimientosActions {
  addMovimiento: (data: Omit<Movimiento, 'id' | 'createdAt'>) => Movimiento;
  removeMovimiento: (movimientoId: string) => void;
  resetMovimientos: () => void;
  createExpense: (
    data: Omit<Movimiento, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<
    { ok: true; value: Movimiento } | { ok: false; reason: 'invalid_data' | 'persistence_failed' }
  >;
  updateExpense: (
    movimientoId: string,
    changes: Partial<Pick<Movimiento, 'monto' | 'descripcion' | 'categoria' | 'fecha'>>
  ) => Promise<
    | { ok: true; value: Movimiento }
    | { ok: false; reason: 'not_found' | 'invalid_data' | 'persistence_failed' }
  >;
  deleteExpense: (
    movimientoId: string
  ) => Promise<
    { ok: true; value: Movimiento } | { ok: false; reason: 'not_found' | 'persistence_failed' }
  >;
}

type MovimientosStore = MovimientosState & MovimientosActions;

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const useMovimientosStore = create<MovimientosStore>()(
  persist(
    (set, get) => ({
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
        // circuito de deposits para que el progreso de la meta siga vivo. El
        // depósito se liga 1:1 con el movimiento (mismo id) para poder revertirlo
        // si el estudiante borra el movimiento.
        if (movimiento.tipo === 'ahorro' && movimiento.goalId) {
          void (async () => {
            const { useSavingsStore } = await import('@features/savings/store/useSavingsStore');
            useSavingsStore
              .getState()
              .addDeposit(
                movimiento.monto,
                movimiento.descripcion,
                movimiento.goalId,
                undefined,
                movimiento.id
              );
          })();
        }

        return movimiento;
      },

      removeMovimiento: (movimientoId) => {
        const movimiento = get().movimientos.find((m) => m.id === movimientoId);
        set((s) => ({ movimientos: s.movimientos.filter((m) => m.id !== movimientoId) }));

        // Revierte el puente: si era un ahorro ligado a una meta, deshace el
        // depósito para no dejar progreso de meta ni total ahorrado fantasma.
        if (movimiento?.tipo === 'ahorro' && movimiento.goalId) {
          void (async () => {
            const { useSavingsStore } = await import('@features/savings/store/useSavingsStore');
            useSavingsStore.getState().removeDeposit(movimiento.id);
          })();
        }

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

      createExpense: async (data) => {
        const now = Date.now();
        if (
          data.tipo !== 'gasto' ||
          !Number.isInteger(data.monto) ||
          data.monto <= 0 ||
          !data.descripcion.trim() ||
          (data.fecha ?? now) > now
        ) {
          return { ok: false, reason: 'invalid_data' };
        }
        const movimiento: Movimiento = {
          ...data,
          descripcion: data.descripcion.trim(),
          fecha: data.fecha ?? now,
          id: `mov_${uid()}`,
          createdAt: now,
          updatedAt: now,
        };
        const previous = get().movimientos;
        set({ movimientos: [...previous, movimiento] });
        try {
          const { useAuthStore } = await import('@features/auth/store/useAuthStore');
          const authUid = useAuthStore.getState().firebaseUid;
          if (authUid) {
            const { movimientosRepository } =
              await import('@features/savings/data/movimientosRepository');
            await movimientosRepository.upsertMovimiento(authUid, movimiento);
          }
          void logEvent('movimiento_registrado', { origen: movimiento.origen, tipo: 'gasto' });
          return { ok: true, value: movimiento };
        } catch (error) {
          set({ movimientos: previous });
          void import('@shared/lib/analytics/crashlytics').then((module) =>
            module.recordError(
              error instanceof Error ? error : new Error(String(error)),
              'movimientos_create_expense'
            )
          );
          return { ok: false, reason: 'persistence_failed' };
        }
      },

      updateExpense: async (movimientoId, changes) => {
        const previous = get().movimientos;
        const current = previous.find((movimiento) => movimiento.id === movimientoId);
        if (!current) return { ok: false, reason: 'not_found' };
        const updated: Movimiento = {
          ...current,
          ...changes,
          descripcion: changes.descripcion?.trim() ?? current.descripcion,
          updatedAt: Date.now(),
        };
        if (
          updated.tipo !== 'gasto' ||
          !Number.isInteger(updated.monto) ||
          updated.monto <= 0 ||
          !updated.descripcion ||
          (updated.fecha ?? updated.createdAt) > Date.now()
        ) {
          return { ok: false, reason: 'invalid_data' };
        }
        set({
          movimientos: previous.map((movimiento) =>
            movimiento.id === movimientoId ? updated : movimiento
          ),
        });
        try {
          const { useAuthStore } = await import('@features/auth/store/useAuthStore');
          const authUid = useAuthStore.getState().firebaseUid;
          if (authUid) {
            const { movimientosRepository } =
              await import('@features/savings/data/movimientosRepository');
            await movimientosRepository.upsertMovimiento(authUid, updated);
          }
          void logEvent('movimiento_actualizado', { origen: updated.origen, tipo: 'gasto' });
          return { ok: true, value: updated };
        } catch (error) {
          set({ movimientos: previous });
          void import('@shared/lib/analytics/crashlytics').then((module) =>
            module.recordError(
              error instanceof Error ? error : new Error(String(error)),
              'movimientos_update_expense'
            )
          );
          return { ok: false, reason: 'persistence_failed' };
        }
      },

      deleteExpense: async (movimientoId) => {
        const previous = get().movimientos;
        const current = previous.find((movimiento) => movimiento.id === movimientoId);
        if (!current) return { ok: false, reason: 'not_found' };
        set({ movimientos: previous.filter((movimiento) => movimiento.id !== movimientoId) });
        try {
          const { useAuthStore } = await import('@features/auth/store/useAuthStore');
          const authUid = useAuthStore.getState().firebaseUid;
          if (authUid) {
            const { movimientosRepository } =
              await import('@features/savings/data/movimientosRepository');
            await movimientosRepository.removeMovimiento(authUid, movimientoId);
          }
          void logEvent('movimiento_eliminado', { origen: current.origen, tipo: 'gasto' });
          return { ok: true, value: current };
        } catch (error) {
          set({ movimientos: previous });
          void import('@shared/lib/analytics/crashlytics').then((module) =>
            module.recordError(
              error instanceof Error ? error : new Error(String(error)),
              'movimientos_delete_expense'
            )
          );
          return { ok: false, reason: 'persistence_failed' };
        }
      },
    }),
    {
      name: 'movimientos-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
    }
  )
);
