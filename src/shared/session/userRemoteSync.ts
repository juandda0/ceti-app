import { onSnapshot } from 'firebase/firestore';
import { getFirebaseClients, isFirebaseConfigured } from '@shared/lib/firebase/app';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import type { SavingsGoal, SavingsDeposit } from '@features/savings/store/useSavingsStore';
import { recordError } from '@shared/lib/analytics/crashlytics';
import { userGoalsCollectionRef, userDepositsCollectionRef } from '@shared/lib/firebase/paths';
import {
  resetUserProgressPushSubscriptions,
  startUserProgressPush,
} from '@shared/session/userProgressPush';

let applyingSnapshot = false;

export function beginRemoteApply() {
  applyingSnapshot = true;
}
export function endRemoteApply() {
  applyingSnapshot = false;
}
export function isApplyingSnapshot() {
  return applyingSnapshot;
}

let unsubs: (() => void)[] = [];
let activeSyncUid = '';

export function stopUserRemoteSync(): void {
  activeSyncUid = '';
  resetUserProgressPushSubscriptions();
  unsubs.forEach((u) => u());
  unsubs = [];
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

  startUserProgressPush(uid);

  function listenGoals(listenUid: string) {
    unsubs.push(
      onSnapshot(
        userGoalsCollectionRef(db, listenUid),
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          beginRemoteApply();
          try {
            const goals = snap.docs
              .map((x) => x.data() as SavingsGoal)
              .filter((g) => g && typeof g.id === 'string');
            useSavingsStore.setState({ goals });
          } finally {
            endRemoteApply();
          }
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
          beginRemoteApply();
          try {
            const deposits = snap.docs
              .map((x) => x.data() as SavingsDeposit)
              .filter((d) => d && typeof d.id === 'string');
            useSavingsStore.setState({ deposits });
          } finally {
            endRemoteApply();
          }
        },
        (err) => retryOnPermissionDenied(listenUid, listenDeposits, 'user_remote_deposits', err)
      )
    );
  }

  listenGoals(uid);
  listenDeposits(uid);
}
