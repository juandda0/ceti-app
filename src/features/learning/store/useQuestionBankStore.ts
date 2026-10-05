/**
 * useQuestionBankStore — client state for the static quiz (R7, R9).
 *
 * fetchWorldQuestions(grado, worldId, seedKey) assembles exactly 10 items
 * (4 MC + 3 VF + 3 ordenar) deterministically via QuestionBankRepository and
 * caches them by worldId. The total per world is always 10.
 *
 * Progress (answers / mastery) is persisted via MMKV (no PII, R4).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import type { QuizItem, WorldId, Grado } from '@features/learning/data/quiz.types';
import type { CourseContentRef } from '@shared/types/tenancy';
import { isMastered } from '@features/learning/data/mastery';

interface QuestionAnswer {
  uid: string;
  questionId: string;
  worldId: WorldId;
  isCorrect: boolean;
  answeredAt: number;
}

interface QuestionBankState {
  questionsByWorld: Partial<Record<WorldId, QuizItem[]>>;
  /**
   * Cache key per world = `${grado}:${seedKey}`. The assembled 10 items depend on
   * BOTH the grade (which banco) and the student (which 10 are sampled), so the
   * guard must key on both — keying on worldId alone served the wrong grade's
   * content after the real grado resolved, and one student's sample to another.
   */
  fetchedKeyByWorld: Partial<Record<WorldId, string>>;
  fetchStatus: Partial<Record<WorldId, 'idle' | 'loading' | 'success' | 'error'>>;
  answers: QuestionAnswer[];
  /**
   * Per-world mastery (0..1) hydrated from the backend on app load.
   * Lets unlock/progress survive logout and new devices, where the local `answers`
   * cache is empty. Combined with local answers via max() (never summed).
   */
  remoteProgress: Partial<Record<WorldId, number>>;
}

interface QuestionBankActions {
  /**
   * Fetches and assembles 10 items for (grado, worldId) deterministically.
   * seedKey should be the student's uid (or localProfileId in demo/offline mode)
   * so the same 10 items are returned for the same student each time (R7).
   * `courseContent` (RQ-PR11) points at the course's custom copies; its
   * `version` invalidates the cache when the professor saves content.
   */
  fetchWorldQuestions: (
    grado: Grado,
    worldId: WorldId,
    seedKey?: string,
    courseContent?: CourseContentRef | null
  ) => Promise<void>;
  recordAnswer: (uid: string, questionId: string, worldId: WorldId, isCorrect: boolean) => void;
  getWorldProgress: (uid: string, worldId: WorldId) => { done: number; total: number };
  getAnsweredIds: (uid: string, worldId: WorldId) => Set<string>;
  isWorldComplete: (uid: string, worldId: WorldId) => boolean;
  /** Replace remote mastery snapshot (authoritative for the session). */
  setRemoteProgress: (byWorld: Partial<Record<WorldId, number>>) => void;
  resetUserProgress: () => void;
}

type QuestionBankStore = QuestionBankState & QuestionBankActions;

/** Total items per world — fixed by R9 (4 MC + 3 VF + 3 ordenar = 10). */
export const QUESTIONS_PER_WORLD = 10;

const initialState: QuestionBankState = {
  questionsByWorld: {},
  fetchedKeyByWorld: {},
  fetchStatus: {},
  answers: [],
  remoteProgress: {},
};

export const useQuestionBankStore = create<QuestionBankStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      fetchWorldQuestions: async (grado, worldId, seedKey = 'default', courseContent = null) => {
        // Cache key = grade + student + config version: a change of grade or
        // student re-fetches, and a professor content save (which bumps the
        // config version, RQ-PR11 CA4) invalidates for the next attempt.
        const key = `${grado}:${seedKey}:v${courseContent?.version ?? 0}`;
        if (get().fetchedKeyByWorld[worldId] === key) return;

        set((s) => ({ fetchStatus: { ...s.fetchStatus, [worldId]: 'loading' } }));

        try {
          const { questionBankRepository } =
            await import('@features/learning/data/QuestionBankRepository');
          const questions = await questionBankRepository.fetchAssembledQuiz(
            grado,
            worldId,
            seedKey,
            courseContent
          );

          if (questions.length === 0) {
            // Banco missing or insufficient — surface as error so the screen
            // shows the offline/unavailable state instead of an empty quiz.
            set((s) => ({ fetchStatus: { ...s.fetchStatus, [worldId]: 'error' } }));
            return;
          }

          set((s) => ({
            questionsByWorld: { ...s.questionsByWorld, [worldId]: questions },
            fetchedKeyByWorld: { ...s.fetchedKeyByWorld, [worldId]: key },
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
        // Use the actual fetched question count. Falls back to QUESTIONS_PER_WORLD
        // only when a fetch succeeded but returned questions (should always be 10
        // per R9). If questions haven't been fetched yet, total stays 0 so remote
        // mastery correctly contributes 0 while offline.
        const fetched = get().questionsByWorld[worldId];
        const total = fetched != null ? fetched.length || QUESTIONS_PER_WORLD : 0;
        const localDone = get().answers.filter(
          (a) => a.uid === uid && a.worldId === worldId && a.isCorrect
        ).length;
        // Remote mastery (0..1) reconstructs the correct-answer count.
        // max() keeps progress monotonic without double-counting.
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
        const { done, total } = get().getWorldProgress(uid, worldId);
        return isMastered(done, total);
      },

      setRemoteProgress: (byWorld) => set({ remoteProgress: byWorld }),

      // Reset on user switch (e.g. demo role swap): also drop the content cache so
      // the next student re-assembles their own (grado, seedKey) set.
      resetUserProgress: () =>
        set({ answers: [], remoteProgress: {}, questionsByWorld: {}, fetchedKeyByWorld: {} }),
    }),
    {
      name: 'question-bank-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
      // Persist ONLY answered progress. The assembled-question cache is content
      // that depends on (grado, seedKey); persisting it risked serving a stale
      // grade/student's questions across restarts — always re-fetch on load.
      partialize: (state) => ({
        answers: state.answers,
      }),
    }
  )
);
