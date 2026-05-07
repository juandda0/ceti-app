/**
 * Registro multi-niño: snapshots del estado completo por id para poder cambiar de perfil activo.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import { useChildStore, type ChildState } from '@features/auth/store/useChildStore';

export type SerializedChildProfile = Pick<
  ChildState,
  | 'id'
  | 'nickname'
  | 'fullName'
  | 'age'
  | 'avatarId'
  | 'avatarEmoji'
  | 'isOnboarded'
  | 'level'
  | 'xp'
  | 'streak'
  | 'lastStreakMissionDate'
  | 'missionCalendarDays'
  | 'totalLessonsCompleted'
  | 'savingsDecisions'
  | 'goalsCompleted'
  | 'unlockedBadges'
  | 'lastCelebratedLevel'
  | 'accuracy'
  | 'savingsHistory'
  | 'educationHistory'
>;

function toSnapshot(state: ChildState): SerializedChildProfile {
  return {
    id: state.id,
    nickname: state.nickname,
    fullName: state.fullName,
    age: state.age,
    avatarId: state.avatarId,
    avatarEmoji: state.avatarEmoji,
    isOnboarded: state.isOnboarded,
    level: state.level,
    xp: state.xp,
    streak: state.streak,
    lastStreakMissionDate: state.lastStreakMissionDate,
    missionCalendarDays: state.missionCalendarDays,
    totalLessonsCompleted: state.totalLessonsCompleted,
    savingsDecisions: state.savingsDecisions,
    goalsCompleted: state.goalsCompleted,
    unlockedBadges: state.unlockedBadges,
    lastCelebratedLevel: state.lastCelebratedLevel,
    accuracy: state.accuracy,
    savingsHistory: state.savingsHistory,
    educationHistory: state.educationHistory,
  };
}

export function snapshotActiveChildFromStore(): SerializedChildProfile | null {
  const s = useChildStore.getState();
  if (!s.isOnboarded || !s.id) return null;
  return toSnapshot(s);
}

interface RegistryState {
  profiles: Record<string, SerializedChildProfile>;
  order: string[];
}

interface RegistryActions {
  commitActiveChildIfOnboarded: () => void;
  activateChildProfile: (childId: string) => void;
  removeChildProfile: (childId: string) => void;
  listChildIds: () => string[];
}

type RegistryStore = RegistryState & RegistryActions;

const emptyRegistry: RegistryState = {
  profiles: {},
  order: [],
};

export const useChildrenRegistryStore = create<RegistryStore>()(
  persist(
    (set, get) => ({
      ...emptyRegistry,

      commitActiveChildIfOnboarded: () => {
        const s = useChildStore.getState();
        if (!s.isOnboarded || !s.id) return;
        const snap = toSnapshot(s);
        set((st) => {
          const order = st.order.includes(s.id) ? st.order : [...st.order, s.id];
          return {
            profiles: { ...st.profiles, [s.id]: snap },
            order,
          };
        });
      },

      activateChildProfile: (childId) => {
        get().commitActiveChildIfOnboarded();
        const snap = get().profiles[childId];
        if (!snap) return;
        useChildStore.getState().resetChild();
        useChildStore.getState().loadProfile(snap);
      },

      removeChildProfile: (childId) => {
        set((st) => {
          const { [childId]: _, ...rest } = st.profiles;
          return {
            profiles: rest,
            order: st.order.filter((id) => id !== childId),
          };
        });
      },

      listChildIds: () => get().order.filter((id) => Boolean(get().profiles[id])),
    }),
    {
      name: 'children-registry',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
    }
  )
);
