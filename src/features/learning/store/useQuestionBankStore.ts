import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import type { QuestionBankItem, WorldId } from '@features/learning/data/questionBank.types';
import { isMastered } from '@features/learning/data/mastery';

interface QuestionAnswer {
  uid: string;
  questionId: string;
  worldId: WorldId;
  isCorrect: boolean;
  answeredAt: number;
}

interface QuestionBankState {
  questionsByWorld: Partial<Record<WorldId, QuestionBankItem[]>>;
  fetchedWorlds: WorldId[];
  fetchStatus: Partial<Record<WorldId, 'idle' | 'loading' | 'success' | 'error'>>;
  answers: QuestionAnswer[];
  /**
   * Per-world mastery (0..1) hydrated from the Firestore tenant tree on app load.
   * Lets unlock/progress survive logout/new-device, where the local `answers`
   * cache is empty. Combined with local answers via max() (never summed).
   */
  remoteProgress: Partial<Record<WorldId, number>>;
}

interface QuestionBankActions {
  fetchWorldQuestions: (worldId: WorldId) => Promise<void>;
  recordAnswer: (uid: string, questionId: string, worldId: WorldId, isCorrect: boolean) => void;
  getWorldProgress: (uid: string, worldId: WorldId) => { done: number; total: number };
  getAnsweredIds: (uid: string, worldId: WorldId) => Set<string>;
  isWorldComplete: (uid: string, worldId: WorldId) => boolean;
  /** Replace remote mastery snapshot (authoritative for the session). */
  setRemoteProgress: (byWorld: Partial<Record<WorldId, number>>) => void;
  resetUserProgress: () => void;
}

type QuestionBankStore = QuestionBankState & QuestionBankActions;

const initialState: QuestionBankState = {
  questionsByWorld: {},
  fetchedWorlds: [],
  fetchStatus: {},
  answers: [],
  remoteProgress: {},
};

export const useQuestionBankStore = create<QuestionBankStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      fetchWorldQuestions: async (worldId) => {
        if (get().fetchedWorlds.includes(worldId)) return;

        set((s) => ({ fetchStatus: { ...s.fetchStatus, [worldId]: 'loading' } }));

        try {
          const { questionBankRepository } =
            await import('@features/learning/data/QuestionBankRepository');
          const questions = await questionBankRepository.fetchByWorldId(worldId);

          set((s) => ({
            questionsByWorld: { ...s.questionsByWorld, [worldId]: questions },
            fetchedWorlds: [...s.fetchedWorlds, worldId],
            fetchStatus: { ...s.fetchStatus, [worldId]: 'success' },
          }));
        } catch (err) {
          if (__DEV__) console.warn('[questionBank] fetchWorldQuestions error:', err);
          set((s) => ({ fetchStatus: { ...s.fetchStatus, [worldId]: 'error' } }));
        }
      },

      recordAnswer: (uid, questionId, worldId, isCorrect) => {
        set((s) => ({
          answers: [
            ...s.answers.filter((a) => !(a.uid === uid && a.questionId === questionId)),
            { uid, questionId, worldId, isCorrect, answeredAt: Date.now() },
          ],
        }));
      },

      getWorldProgress: (uid, worldId) => {
        const total = (get().questionsByWorld[worldId] ?? []).length;
        const localDone = get().answers.filter(
          (a) => a.uid === uid && a.worldId === worldId && a.isCorrect
        ).length;
        // Remote mastery (0..1) reconstructs the correct-answer count from the
        // tenant tree. max() keeps progress monotonic without double-counting.
        const remoteMastery = get().remoteProgress[worldId];
        const remoteDone =
          remoteMastery != null && total > 0 ? Math.round(remoteMastery * total) : 0;
        const done = Math.min(total, Math.max(localDone, remoteDone));
        return { done, total };
      },

      getAnsweredIds: (uid, worldId) =>
        new Set(
          get()
            .answers.filter((a) => a.uid === uid && a.worldId === worldId && a.isCorrect)
            .map((a) => a.questionId)
        ),

      isWorldComplete: (uid, worldId) => {
        // Mastery-based (80%), consistent with certificates and badges — a student
        // who has mastered a world unlocks the next one (does not require 100%).
        const { done, total } = get().getWorldProgress(uid, worldId);
        return isMastered(done, total);
      },

      setRemoteProgress: (byWorld) => set({ remoteProgress: byWorld }),

      resetUserProgress: () => set({ answers: [], remoteProgress: {} }),
    }),
    {
      name: 'question-bank-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
      partialize: (state) => ({
        questionsByWorld: state.questionsByWorld,
        fetchedWorlds: state.fetchedWorlds,
        answers: state.answers,
      }),
    }
  )
);
