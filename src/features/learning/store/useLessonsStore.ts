// store/useLessonsStore.ts — Progreso de lecciones
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LessonProgress {
  childId: string;
  lessonId: string;
  completedAt: number;
  quizScore: number; // Porcentaje de respuestas correctas (0-100)
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
  completeLesson: (childId: string, lessonId: string, quizScore: number) => void;
  isLessonCompleted: (childId: string, lessonId: string) => boolean;
  getLessonProgress: (childId: string, lessonId: string) => LessonProgress | undefined;
  getLessonsForChild: (childId: string) => LessonProgress[];
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
        set((state) => ({
          currentStepIndex: state.currentStepIndex + 1,
        }));
      },

      completeLesson: (childId, lessonId, quizScore) => {
        const { completedLessons } = get();
        const alreadyCompleted = completedLessons.some(
          (lp) => lp.childId === childId && lp.lessonId === lessonId
        );

        if (!alreadyCompleted) {
          const progress: LessonProgress = {
            childId,
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
        } else {
          set({ currentLessonId: null, currentStepIndex: 0 });
        }
      },

      isLessonCompleted: (childId, lessonId) => {
        return get().completedLessons.some((lp) => lp.childId === childId && lp.lessonId === lessonId);
      },

      getLessonProgress: (childId, lessonId) => {
        return get().completedLessons.find((lp) => lp.childId === childId && lp.lessonId === lessonId);
      },

      getLessonsForChild: (childId) => {
        return get().completedLessons.filter(lp => lp.childId === childId);
      },

      resetLessons: () => set(initialState),
    }),
    {
      name: 'lessons-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
