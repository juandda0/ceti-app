// store/useChildStore.ts — Perfil, nivel, XP, streak del niño
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLevelForXP } from '@shared/data/levels';

interface ChildState {
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
  lastActiveDate: string;
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
  setProfile: (nickname: string, fullName: string, age: number, avatarId: string) => void;
  loadProfile: (profile: Partial<ChildState>) => void;
  addXP: (amount: number) => void;
  updateStreak: () => void;
  unlockBadge: (badgeId: string) => void;
  incrementLessonsCompleted: () => void;
  incrementSavingsDecisions: () => void;
  incrementGoalsCompleted: () => void;
  celebrateLevel: (level: number) => void;
  resetChild: () => void;
}

type ChildStore = ChildState & ChildActions;

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
  lastActiveDate: '',
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

      setProfile: (nickname, fullName, age, avatarId) => {
        set({
          nickname,
          fullName,
          age,
          avatarId,
          isOnboarded: true,
        });
      },

      loadProfile: (profile) => {
        set((state) => ({
          ...state,
          ...profile,
          isOnboarded: true,
        }));
      },

      addXP: (amount) => {
        const currentXP = get().xp;
        const newXP = currentXP + amount;
        const newLevel = getLevelForXP(newXP).level;
        set({ xp: newXP, level: newLevel });
      },

      updateStreak: () => {
        const today = new Date().toISOString().split('T')[0];
        const lastDate = get().lastActiveDate;

        if (lastDate === today) return; // Ya actualizó hoy

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (lastDate === yesterdayStr) {
          // Día consecutivo
          set((state) => ({
            streak: state.streak + 1,
            lastActiveDate: today,
          }));
        } else {
          // Se rompió la racha
          set({
            streak: 1,
            lastActiveDate: today,
          });
        }
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

      resetChild: () => set(initialState),
    }),
    {
      name: 'child-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
