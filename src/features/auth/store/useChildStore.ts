// store/useChildStore.ts — Perfil, nivel, XP, streak del niño
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

export interface ChildState {
  // Perfil
  id: string;
  nickname: string;
  fullName: string;
  age: number;
  avatarId: string;
  avatarEmoji: string;
  isOnboarded: boolean;

  // Progreso
  level: number;
  xp: number;
  streak: number;
  /** Último día (YYYY-MM-DD local) en que una misión completada sumó a la racha. */
  lastStreakMissionDate: string;
  /** Días locales (YYYY-MM-DD) con al menos una misión completada (lección aprobada). */
  missionCalendarDays: string[];
  totalLessonsCompleted: number;
  savingsDecisions: number;
  goalsCompleted: number;
  unlockedBadges: string[];
  // Métricas
  lastCelebratedLevel: number;
  accuracy: number;
  savingsHistory: number[];
  educationHistory: number[];
}

interface ChildActions {
  setProfile: (
    nickname: string,
    fullName: string,
    age: number,
    avatarId: string,
    avatarEmoji: string
  ) => void;
  loadProfile: (profile: Partial<ChildState>) => void;
  addXP: (amount: number) => void;
  /** Al completar una misión (p. ej. lección): como máximo 1 vez por día calendario local. */
  recordStreakOnMissionComplete: () => StreakCelebrationPayload | null;
  /** Registra el día calendario en que hubo misión (para UI semanal); idempotente por día. */
  registerMissionCalendarDay: (date?: string) => void;
  unlockBadge: (badgeId: string) => void;
  incrementLessonsCompleted: () => void;
  incrementSavingsDecisions: () => void;
  incrementGoalsCompleted: () => void;
  celebrateLevel: (level: number) => void;
  resetChild: () => void;
}

type ChildStore = ChildState & ChildActions;

function ensureChildId(existing: string | undefined): string {
  const t = (existing ?? '').trim();
  if (t.length > 0) return t;
  return `child_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

const initialState: ChildState = {
  id: '',
  nickname: '',
  fullName: '',
  age: 0,
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

export const useChildStore = create<ChildStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setProfile: (nickname, fullName, age, avatarId, avatarEmoji) => {
        set((state) => ({
          ...state,
          id: ensureChildId(state.id),
          nickname,
          fullName,
          age,
          avatarId,
          avatarEmoji,
          isOnboarded: true,
        }));
      },

      loadProfile: (profile) => {
        set((state) => ({
          ...state,
          ...profile,
          id: ensureChildId((profile.id ?? state.id) as string),
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

        if (lastMissionDay === today) {
          return null;
        }

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
        set((state) => ({
          totalLessonsCompleted: state.totalLessonsCompleted + 1,
        }));
      },

      incrementSavingsDecisions: () => {
        set((state) => ({
          savingsDecisions: state.savingsDecisions + 1,
        }));
      },

      incrementGoalsCompleted: () => {
        set((state) => ({
          goalsCompleted: state.goalsCompleted + 1,
        }));
      },
      celebrateLevel: (level) => set({ lastCelebratedLevel: level }),

      resetChild: () => {
        useStreakCelebrationStore.getState().clear();
        set(initialState);
      },
    }),
    {
      name: 'child-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
      merge: (persistedState, currentState) => {
        const p = (persistedState ?? {}) as Partial<ChildState> & { lastActiveDate?: string };
        const persistedId =
          typeof p.id === 'string' && p.id.trim().length > 0
            ? p.id.trim()
            : ensureChildId(currentState.id);
        const today = getLocalCalendarYMD();
        let lastStreakMissionDate =
          typeof p.lastStreakMissionDate === 'string' ? p.lastStreakMissionDate.trim() : '';
        if (!lastStreakMissionDate) {
          const legacy = typeof p.lastActiveDate === 'string' ? p.lastActiveDate.trim() : '';
          if (legacy && legacy !== today) {
            lastStreakMissionDate = legacy;
          }
        }
        return {
          ...currentState,
          ...p,
          id: persistedId,
          lastStreakMissionDate,
          missionCalendarDays: Array.isArray(p.missionCalendarDays) ? p.missionCalendarDays : [],
        } as ChildStore;
      },
    }
  )
);
