import { onSnapshot } from 'firebase/firestore';
import { getFirebaseClients, isFirebaseConfigured } from '@shared/lib/firebase/app';
import { useUserStore, type UserState } from '@features/auth/store/useUserStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import type { SavingsGoal, SavingsDeposit } from '@features/savings/store/useSavingsStore';
import { useLessonsStore } from '@features/learning/store/useLessonsStore';
import type { RemoteLessonProgress } from '@features/learning/data/lessonProgressRepository';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import type { RemoteWalletState } from '@features/savings/data/walletRepository';
import { recordError } from '@shared/lib/analytics/crashlytics';
import {
  userGoalsCollectionRef,
  userDepositsCollectionRef,
  userLessonProgressCollectionRef,
  userWalletDocRef,
} from '@shared/lib/firebase/paths';
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

function applyUserDocPartial(d: Partial<UserState> & Record<string, unknown>): void {
  const patch: Record<string, unknown> = {};
  if (typeof d.nickname === 'string') patch.nickname = d.nickname;
  if (typeof d.fullName === 'string') patch.fullName = d.fullName;
  if (typeof d.age === 'number') patch.age = d.age;
  if (typeof d.avatarId === 'string') patch.avatarId = d.avatarId;
  if (typeof d.avatarEmoji === 'string') patch.avatarEmoji = d.avatarEmoji;
  if (typeof d.level === 'number') patch.level = d.level;
  if (typeof d.xp === 'number') patch.xp = d.xp;
  if (typeof d.streak === 'number') patch.streak = d.streak;
  if (typeof d.lastStreakMissionDate === 'string')
    patch.lastStreakMissionDate = d.lastStreakMissionDate;
  if (Array.isArray(d.missionCalendarDays)) patch.missionCalendarDays = d.missionCalendarDays;
  if (typeof d.totalLessonsCompleted === 'number')
    patch.totalLessonsCompleted = d.totalLessonsCompleted;
  if (typeof d.savingsDecisions === 'number') patch.savingsDecisions = d.savingsDecisions;
  if (Array.isArray(d.unlockedBadges)) patch.unlockedBadges = d.unlockedBadges;
  if (typeof d.lastCelebratedLevel === 'number') patch.lastCelebratedLevel = d.lastCelebratedLevel;

  if (Object.keys(patch).length > 0) {
    useUserStore.getState().loadProfile(patch as Partial<UserState>);
  }
}

function applyWalletSnapshot(data: RemoteWalletState): void {
  useWalletStore.setState({
    totalCetis: typeof data.totalCetis === 'number' ? data.totalCetis : 0,
    savedCetis: typeof data.savedCetis === 'number' ? data.savedCetis : 0,
    spentCetis: typeof data.spentCetis === 'number' ? data.spentCetis : 0,
    transactions: Array.isArray(data.transactions) ? data.transactions.slice(0, 50) : [],
    savingsGoal:
      data.savingsGoal === null || typeof data.savingsGoal === 'object' ? data.savingsGoal : null,
  });
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
            useUserStore.getState().syncGoalsCompleted();
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

  function listenLessonProgress(listenUid: string) {
    unsubs.push(
      onSnapshot(
        userLessonProgressCollectionRef(db, listenUid),
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          beginRemoteApply();
          try {
            const rows: RemoteLessonProgress[] = snap.docs
              .map((x) => x.data() as RemoteLessonProgress)
              .filter((l) => l && typeof l.lessonId === 'string')
              .map((l) => ({
                uid: listenUid,
                lessonId: l.lessonId,
                completedAt: typeof l.completedAt === 'number' ? l.completedAt : Date.now(),
                quizScore: typeof l.quizScore === 'number' ? l.quizScore : 0,
                perfectQuiz: Boolean(l.perfectQuiz),
              }));
            useLessonsStore.setState((s) => ({
              completedLessons: [
                ...s.completedLessons.filter((lp) => lp.uid !== listenUid),
                ...rows,
              ],
            }));
          } finally {
            endRemoteApply();
          }
        },
        (err) =>
          retryOnPermissionDenied(listenUid, listenLessonProgress, 'user_remote_lessons', err)
      )
    );
  }

  function listenWallet(listenUid: string) {
    unsubs.push(
      onSnapshot(
        userWalletDocRef(db, listenUid),
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          beginRemoteApply();
          try {
            if (!snap.exists()) return;
            applyWalletSnapshot(snap.data() as RemoteWalletState);
          } finally {
            endRemoteApply();
          }
        },
        (err) => retryOnPermissionDenied(listenUid, listenWallet, 'user_remote_wallet', err)
      )
    );
  }

  listenGoals(uid);
  listenDeposits(uid);
  listenLessonProgress(uid);
  listenWallet(uid);
}
