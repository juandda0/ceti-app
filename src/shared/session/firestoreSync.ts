import { collection, onSnapshot, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { getFirebaseClients, isFirebaseConfigured } from '@shared/lib/firebase/app';
import { FIRESTORE_COLLECTIONS } from '@shared/lib/firebase/paths';
import type { ChildRemoteProfile } from '@features/auth/data/ChildProfileRepository';
import {
  useChildrenRegistryStore,
  type SerializedChildProfile,
} from '@features/auth/store/useChildrenRegistryStore';
import { recordError } from '@shared/lib/analytics/crashlytics';

function seedSerializedFromRemote(data: ChildRemoteProfile): SerializedChildProfile {
  return {
    id: data.id,
    nickname: data.nickname,
    fullName: '',
    age: data.age,
    avatarId: '',
    avatarEmoji: data.avatarEmoji || '',
    isOnboarded: true,
    level: 1,
    xp: 0,
    streak: 0,
    lastStreakMissionDate: '',
    missionCalendarDays: [],
    totalLessonsCompleted: 0,
    savingsDecisions: 0,
    goalsCompleted: 0,
    unlockedBadges: [],
    lastCelebratedLevel: 1,
    accuracy: 0,
    savingsHistory: [],
    educationHistory: [],
  };
}

let activeUnsub: (() => void) | null = null;

/** Sincroniza perfiles hijo desde Firestore (last-write-wins en campos remotos). */
export function startFamilyChildrenRemoteSync(familyId: string): void {
  stopFamilyChildrenRemoteSync();
  if (!isFirebaseConfigured() || !familyId.trim()) return;

  const clients = getFirebaseClients();
  if (!clients) return;

  const colRef = collection(
    clients.firestore,
    FIRESTORE_COLLECTIONS.families,
    familyId,
    FIRESTORE_COLLECTIONS.children
  );

  activeUnsub = onSnapshot(
    colRef,
    (snap: QuerySnapshot<DocumentData>) => {
      useChildrenRegistryStore.setState((st) => {
        let profiles = { ...st.profiles };
        let order = [...st.order];

        snap.docs.forEach((docSnap) => {
          const data = docSnap.data() as Partial<ChildRemoteProfile>;
          const id = docSnap.id;
          const remote: ChildRemoteProfile = {
            id,
            nickname: typeof data.nickname === 'string' ? data.nickname : '',
            age: typeof data.age === 'number' ? data.age : 0,
            avatarEmoji: typeof data.avatarEmoji === 'string' ? data.avatarEmoji : '',
            updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
          };

          const prev = profiles[id];
          if (prev) {
            profiles[id] = {
              ...prev,
              nickname: remote.nickname || prev.nickname,
              age: remote.age || prev.age,
              avatarEmoji: remote.avatarEmoji || prev.avatarEmoji,
            };
          } else {
            profiles[id] = seedSerializedFromRemote(remote);
          }
          if (!order.includes(id)) order.push(id);
        });

        return { profiles, order };
      });
    },
    (err) => {
      void recordError(err, 'firestore_sync_children');
    }
  );
}

export function stopFamilyChildrenRemoteSync(): void {
  activeUnsub?.();
  activeUnsub = null;
}
