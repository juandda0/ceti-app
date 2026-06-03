import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';

interface LessonProgress {
  uid: string;
  lessonId: string;
  completedAt: number;
  quizScore: number;
  perfectQuiz: boolean;
}

interface LessonsState {
  completedLessons: LessonProgress[];
  currentLessonId: string | null;
  currentStepIndex: number;
}

interface LessonsActions {
  startLesson: (lessonId: string) => void;
  advanceStep: () => void;
  completeLesson: (uid: string, lessonId: string, quizScore: number) => boolean;
  isLessonCompleted: (uid: string, lessonId: string) => boolean;
  getLessonProgress: (uid: string, lessonId: string) => LessonProgress | undefined;
  getLessonsForUser: (uid: string) => LessonProgress[];
  resetLessons: () => void;
}

type LessonsStore = LessonsState & LessonsActions;

const initialState: LessonsState = {
  completedLessons: [],
  currentLessonId: null,
  currentStepIndex: 0,
};

export const useLessonsStore = create<LessonsStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      startLesson: (lessonId) => {
        set({ currentLessonId: lessonId, currentStepIndex: 0 });
      },

      advanceStep: () => {
        set((state) => ({ currentStepIndex: state.currentStepIndex + 1 }));
      },

      completeLesson: (uid, lessonId, quizScore) => {
        const { completedLessons } = get();
        const alreadyCompleted = completedLessons.some(
          (lp) => lp.uid === uid && lp.lessonId === lessonId
        );

        if (!alreadyCompleted) {
          const progress: LessonProgress = {
            uid,
            lessonId,
            completedAt: Date.now(),
            quizScore,
            perfectQuiz: quizScore === 100,
          };
          set({
            completedLessons: [...completedLessons, progress],
            currentLessonId: null,
            currentStepIndex: 0,
          });

          void (async () => {
            try {
              const { useAuthStore } = await import('@features/auth/store/useAuthStore');
              const firebaseUid = useAuthStore.getState().firebaseUid;
              if (!firebaseUid) return;
              const { lessonProgressRepository } =
                await import('@features/learning/data/lessonProgressRepository');
              await lessonProgressRepository.upsertLessonProgress(firebaseUid, {
                uid: firebaseUid,
                lessonId: progress.lessonId,
                completedAt: progress.completedAt,
                quizScore: progress.quizScore,
                perfectQuiz: progress.perfectQuiz,
              });
            } catch {
              /* noop */
            }
          })();

          return true;
        }

        set({ currentLessonId: null, currentStepIndex: 0 });
        return false;
      },

      isLessonCompleted: (uid, lessonId) => {
        return get().completedLessons.some((lp) => lp.uid === uid && lp.lessonId === lessonId);
      },

      getLessonProgress: (uid, lessonId) => {
        return get().completedLessons.find((lp) => lp.uid === uid && lp.lessonId === lessonId);
      },

      getLessonsForUser: (uid) => {
        return get().completedLessons.filter((lp) => lp.uid === uid);
      },

      resetLessons: () => set(initialState),
    }),
    {
      name: 'lessons-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
      partialize: (state) => ({
        completedLessons: state.completedLessons,
      }),
    }
  )
);
