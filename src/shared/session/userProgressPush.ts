import { goalsRepository } from '@features/savings/data/goalsRepository';
import { depositsRepository } from '@features/savings/data/depositsRepository';
import { walletRepository } from '@features/savings/data/walletRepository';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useLessonsStore } from '@features/learning/store/useLessonsStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import { isApplyingSnapshot } from '@shared/session/userRemoteSync';

const DEBOUNCE_MS = 400;

let activeUid = '';
let unsubscribers: Array<() => void> = [];

let savingsTimer: ReturnType<typeof setTimeout> | null = null;
let lessonsTimer: ReturnType<typeof setTimeout> | null = null;
let walletTimer: ReturnType<typeof setTimeout> | null = null;

let lastGoalIds = new Set<string>();
let lastDepositIds = new Set<string>();

const trackedPromises = new Set<Promise<unknown>>();

function track<T>(p: Promise<T>): void {
  trackedPromises.add(p);
  void p.finally(() => {
    trackedPromises.delete(p);
  });
}

function scheduleSavingsPush(): void {
  if (!activeUid || isApplyingSnapshot()) return;
  if (savingsTimer) clearTimeout(savingsTimer);
  savingsTimer = setTimeout(() => {
    savingsTimer = null;
    if (!activeUid || isApplyingSnapshot()) return;
    const uid = activeUid;
    const { goals, deposits } = useSavingsStore.getState();
    const newGoalIds = new Set(goals.map((g) => g.id));
    const p = (async () => {
      for (const id of lastGoalIds) {
        if (!newGoalIds.has(id)) await goalsRepository.removeGoal(uid, id);
      }
      for (const g of goals) await goalsRepository.upsertGoal(uid, g);
      const newDepIds = new Set(deposits.map((d) => d.id));
      for (const id of lastDepositIds) {
        if (!newDepIds.has(id)) await depositsRepository.removeDeposit(uid, id);
      }
      for (const d of deposits) await depositsRepository.upsertDeposit(uid, d);
      lastGoalIds = newGoalIds;
      lastDepositIds = newDepIds;
    })();
    track(p);
  }, DEBOUNCE_MS);
}

function scheduleWalletPush(): void {
  if (!activeUid || isApplyingSnapshot()) return;
  if (walletTimer) clearTimeout(walletTimer);
  walletTimer = setTimeout(() => {
    walletTimer = null;
    if (!activeUid || isApplyingSnapshot()) return;
    const w = useWalletStore.getState();
    const p = walletRepository.setWalletState(activeUid, {
      totalCetis: w.totalCetis,
      savedCetis: w.savedCetis,
      spentCetis: w.spentCetis,
      transactions: w.transactions.slice(0, 50),
      savingsGoal: w.savingsGoal,
      updatedAt: Date.now(),
    });
    track(p);
  }, DEBOUNCE_MS);
}

export function resetUserProgressPushSubscriptions(): void {
  if (savingsTimer) clearTimeout(savingsTimer);
  if (lessonsTimer) clearTimeout(lessonsTimer);
  if (walletTimer) clearTimeout(walletTimer);
  savingsTimer = null;
  lessonsTimer = null;
  walletTimer = null;
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  activeUid = '';
  lastGoalIds = new Set();
  lastDepositIds = new Set();
}

export async function flushUserProgressPush(): Promise<void> {
  const pending = [...trackedPromises];
  await Promise.allSettled(pending);
}

export function startUserProgressPush(uid: string): void {
  resetUserProgressPushSubscriptions();
  activeUid = uid.trim();
  if (!activeUid) return;

  lastGoalIds = new Set(useSavingsStore.getState().goals.map((g) => g.id));
  lastDepositIds = new Set(useSavingsStore.getState().deposits.map((d) => d.id));

  unsubscribers.push(
    useUserStore.subscribe(() => {
      if (isApplyingSnapshot()) return;
    })
  );

  unsubscribers.push(
    useSavingsStore.subscribe((st, prev) => {
      if (st.goals === prev.goals && st.deposits === prev.deposits) return;
      if (isApplyingSnapshot()) return;
      scheduleSavingsPush();
    })
  );

  unsubscribers.push(
    useWalletStore.subscribe(() => {
      if (isApplyingSnapshot()) return;
      scheduleWalletPush();
    })
  );
}
