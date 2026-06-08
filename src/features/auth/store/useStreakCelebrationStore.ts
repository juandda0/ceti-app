import { create } from 'zustand';

export type StreakCelebrationKind = 'first' | 'increment';

export interface StreakCelebrationPayload {
  newStreak: number;
  kind: StreakCelebrationKind;
}

interface StreakCelebrationState {
  pending: StreakCelebrationPayload | null;
  show: (payload: StreakCelebrationPayload) => void;
  clear: () => void;
}

export const useStreakCelebrationStore = create<StreakCelebrationState>((set) => ({
  pending: null,
  show: (payload) => set({ pending: payload }),
  clear: () => set({ pending: null }),
}));
