import { api, isBackendConfigured } from '@shared/lib/api/client';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import {
  useMovimientosStore,
  isExpenseSnapshot,
  MOVIMIENTO_CATEGORIAS,
} from '@features/savings/store/useMovimientosStore';
import { usePresupuestosStore } from '@features/savings/store/usePresupuestosStore';
import { isSavingsGoal, isSavingsOperation } from '@features/savings/domain/savings';
import { recordError } from '@shared/lib/analytics/errorReporting';

type Finanzas = {
  goals: unknown[];
  deposits: unknown[];
  movimientos: unknown[];
  presupuestos: { topes?: unknown } | null;
};

let activeSyncUid = '';

export function stopUserRemoteSync(): void {
  const hadActiveUser = activeSyncUid !== '';
  activeSyncUid = '';
  if (hadActiveUser) {
    useSavingsStore.getState().resetSavings();
    useMovimientosStore.getState().resetMovimientos();
    usePresupuestosStore.getState().resetPresupuestos();
  }
}

function validTopes(topes: unknown): Record<string, number> {
  if (typeof topes !== 'object' || topes === null || Array.isArray(topes)) return {};
  return Object.fromEntries(
    Object.entries(topes).filter(
      ([key, amount]) =>
        MOVIMIENTO_CATEGORIAS.includes(key as (typeof MOVIMIENTO_CATEGORIAS)[number]) &&
        Number.isInteger(amount) &&
        Number(amount) > 0 &&
        Number(amount) <= 100_000_000
    )
  ) as Record<string, number>;
}

/**
 * Carga los datos personales de la cuenta (metas, operaciones, diario,
 * presupuestos) al iniciar sesión. Las escrituras van por los repositorios;
 * aquí solo se rehidrata desde el servidor (fuente de verdad entre dispositivos).
 * ponytail: una carga por sesión en vez de listeners en vivo; recargar al volver
 * a primer plano si un mismo usuario usa dos dispositivos a la vez.
 */
export function startUserRemoteSync(uid: string): void {
  if (activeSyncUid === uid) return;
  stopUserRemoteSync();
  if (!isBackendConfigured() || !uid.trim()) return;
  activeSyncUid = uid;

  void api
    .get<Finanzas>('/api/me/finanzas')
    .then((f) => {
      // Otra cuenta inició sesión mientras llegaba la respuesta: no mezclar datos.
      if (activeSyncUid !== uid) return;
      const goals = f.goals.filter(isSavingsGoal).map((goal) => ({
        ...goal,
        description: '',
        emoji: '',
        currentAmount: 0,
        frequency: 'total' as const,
      }));
      useSavingsStore.setState({ goals, operations: f.deposits.filter(isSavingsOperation) });
      useMovimientosStore.setState({ movimientos: f.movimientos.filter(isExpenseSnapshot) });
      usePresupuestosStore.setState({ topes: validTopes(f.presupuestos?.topes) });
    })
    .catch((e) => recordError(e, 'user_remote_finanzas'));
}
