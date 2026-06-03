import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import type { QuestionBankItem, WorldId } from '@features/learning/data/questionBank.types';

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
}

interface QuestionBankActions {
  fetchWorldQuestions: (worldId: WorldId) => Promise<void>;
  recordAnswer: (uid: string, questionId: string, worldId: WorldId, isCorrect: boolean) => void;
  getWorldProgress: (uid: string, worldId: WorldId) => { done: number; total: number };
  getAnsweredIds: (uid: string, worldId: WorldId) => Set<string>;
  isWorldComplete: (uid: string, worldId: WorldId) => boolean;
  resetUserProgress: () => void;
}

type QuestionBankStore = QuestionBankState & QuestionBankActions;

const initialState: QuestionBankState = {
  questionsByWorld: {},
  fetchedWorlds: [],
  fetchStatus: {},
  answers: [],
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
        const questions = get().questionsByWorld[worldId] ?? [];
        const done = get().answers.filter(
          (a) => a.uid === uid && a.worldId === worldId && a.isCorrect
        ).length;
        return { done, total: questions.length };
      },

      getAnsweredIds: (uid, worldId) =>
        new Set(
          get()
            .answers.filter((a) => a.uid === uid && a.worldId === worldId && a.isCorrect)
            .map((a) => a.questionId)
        ),

      isWorldComplete: (uid, worldId) => {
        const { done, total } = get().getWorldProgress(uid, worldId);
        return total > 0 && done >= total;
      },

      resetUserProgress: () => set({ answers: [] }),
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
