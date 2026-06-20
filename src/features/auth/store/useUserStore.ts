import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import { getLevelForXP } from '@shared/data/levels';
import {
  getLocalCalendarYMD,
  getLocalCalendarYMDDaysAgo,
  getLocalCalendarYMDDaysBefore,
} from '@shared/utils/calendarDate';
import { useStreakCelebrationStore } from '@features/auth/store/useStreakCelebrationStore';
import type { StreakCelebrationPayload } from '@features/auth/store/useStreakCelebrationStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';

export interface UserState {
  id: string;
  nickname: string;
  fullName: string;
  avatarId: string;
  avatarEmoji: string;
  isOnboarded: boolean;
  level: number;
  xp: number;
  streak: number;
  lastStreakMissionDate: string;
  missionCalendarDays: string[];
  totalLessonsCompleted: number;
  savingsDecisions: number;
  goalsCompleted: number;
  unlockedBadges: string[];
  lastCelebratedLevel: number;
  accuracy: number;
  savingsHistory: number[];
  educationHistory: number[];
}

interface UserActions {
  setProfile: (nickname: string, fullName: string, avatarId: string, avatarEmoji: string) => void;
  loadProfile: (profile: Partial<UserState>) => void;
  addXP: (amount: number) => void;
  recordStreakOnMissionComplete: () => StreakCelebrationPayload | null;
  registerMissionCalendarDay: (date?: string) => void;
  unlockBadge: (badgeId: string) => void;
  incrementLessonsCompleted: () => void;
  incrementSavingsDecisions: () => void;
  syncGoalsCompleted: () => void;
  celebrateLevel: (level: number) => void;
  resetUser: () => void;
}

type UserStore = UserState & UserActions;

function ensureId(existing: string | undefined): string {
  const t = (existing ?? '').trim();
  if (t.length > 0) return t;
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

const initialState: UserState = {
  id: '',
  nickname: '',
  fullName: '',
  avatarId: '',
  avatarEmoji: '',
  isOnboarded: false,
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

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setProfile: (nickname, fullName, avatarId, avatarEmoji) => {
        set((state) => ({
          ...state,
          id: ensureId(state.id),
          nickname,
          fullName,
          avatarId,
          avatarEmoji,
          isOnboarded: true,
        }));
      },

      loadProfile: (profile) => {
        set((state) => ({
          ...state,
          ...profile,
          id: ensureId((profile.id ?? state.id) as string),
          isOnboarded: true,
        }));
      },

      addXP: (amount) => {
        const currentXP = get().xp;
        const newXP = currentXP + amount;
        const newLevel = getLevelForXP(newXP).level;
        set({ xp: newXP, level: newLevel });
      },

      recordStreakOnMissionComplete: () => {
        const today = getLocalCalendarYMD();
        const yesterday = getLocalCalendarYMDDaysAgo(1);
        const lastMissionDay = (get().lastStreakMissionDate || '').trim();

        if (lastMissionDay === today) return null;

        if (lastMissionDay === yesterday) {
          const newStreak = get().streak + 1;
          set({ streak: newStreak, lastStreakMissionDate: today });
          return { newStreak, kind: 'increment' as const };
        }

        set({ streak: 1, lastStreakMissionDate: today });
        return { newStreak: 1, kind: 'first' as const };
      },

      registerMissionCalendarDay: (date) => {
        const ymd = (date ?? getLocalCalendarYMD()).trim();
        if (!ymd) return;
        const cutoff = getLocalCalendarYMDDaysBefore(180);
        set((state) => {
          const setDays = new Set(state.missionCalendarDays ?? []);
          setDays.add(ymd);
          const sorted = Array.from(setDays)
            .sort()
            .filter((d) => d >= cutoff);
          return { missionCalendarDays: sorted };
        });
      },

      unlockBadge: (badgeId) => {
        const { unlockedBadges } = get();
        if (!unlockedBadges.includes(badgeId)) {
          set({ unlockedBadges: [...unlockedBadges, badgeId] });
        }
      },

      incrementLessonsCompleted: () => {
        set((state) => ({ totalLessonsCompleted: state.totalLessonsCompleted + 1 }));
      },

      incrementSavingsDecisions: () => {
        set((state) => ({ savingsDecisions: state.savingsDecisions + 1 }));
      },

      syncGoalsCompleted: () => {
        const n = useSavingsStore
          .getState()
          .goals.filter((g) => typeof g.completedAt === 'number' && g.completedAt > 0).length;
        set({ goalsCompleted: n });
      },

      celebrateLevel: (level) => set({ lastCelebratedLevel: level }),

      resetUser: () => {
        useStreakCelebrationStore.getState().clear();
        set(initialState);
      },
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
      merge: (persistedState, currentState) => {
        const p = (persistedState ?? {}) as Partial<UserState>;
        const persistedId =
          typeof p.id === 'string' && p.id.trim().length > 0
            ? p.id.trim()
            : ensureId(currentState.id);
        const today = getLocalCalendarYMD();
        let lastStreakMissionDate =
          typeof p.lastStreakMissionDate === 'string' ? p.lastStreakMissionDate.trim() : '';
        if (!lastStreakMissionDate) {
          const legacy =
            typeof (p as Record<string, unknown>).lastActiveDate === 'string'
              ? String((p as Record<string, unknown>).lastActiveDate).trim()
              : '';
          if (legacy && legacy !== today) lastStreakMissionDate = legacy;
        }
        return {
          ...currentState,
          ...p,
          id: persistedId,
          lastStreakMissionDate,
          missionCalendarDays: Array.isArray(p.missionCalendarDays) ? p.missionCalendarDays : [],
        } as UserStore;
      },
    }
  )
);
