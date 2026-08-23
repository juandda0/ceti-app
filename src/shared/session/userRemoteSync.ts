import { onSnapshot } from 'firebase/firestore';
import { getFirebaseClients, isFirebaseConfigured } from '@shared/lib/firebase/app';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import {
  useMovimientosStore,
  isExpenseSnapshot,
  MOVIMIENTO_CATEGORIAS,
} from '@features/savings/store/useMovimientosStore';
import { usePresupuestosStore } from '@features/savings/store/usePresupuestosStore';
import { isSavingsGoal, isSavingsOperation } from '@features/savings/domain/savings';
import { recordError } from '@shared/lib/analytics/crashlytics';
import {
  userGoalsCollectionRef,
  userDepositsCollectionRef,
  userMovimientosCollectionRef,
  userConfigPresupuestosDocRef,
} from '@shared/lib/firebase/paths';

let unsubs: (() => void)[] = [];
let activeSyncUid = '';

export function stopUserRemoteSync(): void {
  const hadActiveUser = activeSyncUid !== '';
  activeSyncUid = '';
  unsubs.forEach((u) => u());
  unsubs = [];
  if (hadActiveUser) {
    useSavingsStore.getState().resetSavings();
    useMovimientosStore.getState().resetMovimientos();
    usePresupuestosStore.getState().resetPresupuestos();
  }
}

function retryOnPermissionDenied(
  uid: string,
  register: (uid: string) => void,
  context: string,
  err: unknown
): void {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
  if (code === 'permission-denied' && activeSyncUid === uid) {
    setTimeout(() => {
      if (activeSyncUid === uid) register(uid);
    }, 3000);
  } else {
    void recordError(err, context);
  }
}

export function startUserRemoteSync(uid: string): void {
  stopUserRemoteSync();
  if (!isFirebaseConfigured()) return;
  const clients = getFirebaseClients();
  if (!clients?.firestore) return;
  const db = clients.firestore;
  if (!uid.trim()) return;
  activeSyncUid = uid;

  function listenGoals(listenUid: string) {
    unsubs.push(
      onSnapshot(
        userGoalsCollectionRef(db, listenUid),
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          const goals = snap.docs
            .map((x) => x.data())
            .filter(isSavingsGoal)
            .map((goal) => ({
              ...goal,
              description: '',
              emoji: '',
              currentAmount: 0,
              frequency: 'total' as const,
            }));
          useSavingsStore.setState({ goals });
        },
        (err) => retryOnPermissionDenied(listenUid, listenGoals, 'user_remote_goals', err)
      )
    );
  }

  function listenDeposits(listenUid: string) {
    unsubs.push(
      onSnapshot(
        userDepositsCollectionRef(db, listenUid),
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          const operations = snap.docs.map((x) => x.data()).filter(isSavingsOperation);
          useSavingsStore.setState({ operations });
        },
        (err) => retryOnPermissionDenied(listenUid, listenDeposits, 'user_remote_deposits', err)
      )
    );
  }

  function listenMovimientos(listenUid: string) {
    unsubs.push(
      onSnapshot(
        userMovimientosCollectionRef(db, listenUid),
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          useMovimientosStore.setState({
            movimientos: snap.docs.map((item) => item.data()).filter(isExpenseSnapshot),
          });
        },
        (err) => retryOnPermissionDenied(listenUid, listenMovimientos, 'user_remote_expenses', err)
      )
    );
  }

  function listenPresupuestos(listenUid: string) {
    unsubs.push(
      onSnapshot(
        userConfigPresupuestosDocRef(db, listenUid),
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          const topes = snap.data()?.topes;
          if (typeof topes !== 'object' || topes === null || Array.isArray(topes)) {
            usePresupuestosStore.setState({ topes: {} });
            return;
          }
          usePresupuestosStore.setState({
            topes: Object.fromEntries(
              Object.entries(topes).filter(
                ([key, amount]) =>
                  MOVIMIENTO_CATEGORIAS.includes(key as (typeof MOVIMIENTO_CATEGORIAS)[number]) &&
                  Number.isInteger(amount) &&
                  Number(amount) > 0 &&
                  Number(amount) <= 100_000_000
              )
            ),
          });
        },
        (err) => retryOnPermissionDenied(listenUid, listenPresupuestos, 'user_remote_budgets', err)
      )
    );
  }

  listenGoals(uid);
  listenDeposits(uid);
  listenMovimientos(uid);
  listenPresupuestos(uid);
}
