// store/useParentStore.ts — PIN, tareas, configuración del padre
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TaskFrequency = 'once' | 'daily' | 'weekly';

export interface ParentTask {
  id: string;
  name: string;
  cetisReward: number;
  frequency: TaskFrequency;
  isCompleted: boolean;
  createdAt: number;
  completedAt?: number;
}

interface ParentState {
  pin: string;
  isPinSet: boolean;
  tasks: ParentTask[];
  parentName: string;
}

interface ParentActions {
  setPin: (pin: string) => void;
  verifyPin: (pin: string) => boolean;
  setParentName: (name: string) => void;
  addTask: (name: string, cetisReward: number, frequency: TaskFrequency) => void;
  completeTask: (taskId: string) => ParentTask | null;
  removeTask: (taskId: string) => void;
  getPendingTasks: () => ParentTask[];
  getCompletedTasks: () => ParentTask[];
  resetParent: () => void;
}

type ParentStore = ParentState & ParentActions;

function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

const initialState: ParentState = {
  pin: '',
  isPinSet: false,
  tasks: [],
  parentName: '',
};

export const useParentStore = create<ParentStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setPin: (pin) => set({ pin, isPinSet: true }),

      verifyPin: (pin) => get().pin === pin,

      setParentName: (name) => set({ parentName: name }),

      addTask: (name, cetisReward, frequency) => {
        const task: ParentTask = {
          id: generateTaskId(),
          name,
          cetisReward,
          frequency,
          isCompleted: false,
          createdAt: Date.now(),
        };
        set((state) => ({
          tasks: [...state.tasks, task],
        }));
      },

      completeTask: (taskId) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task || task.isCompleted) return null;

        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, isCompleted: true, completedAt: Date.now() }
              : t
          ),
        }));

        return task;
      },

      removeTask: (taskId) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== taskId),
        }));
      },

      getPendingTasks: () => {
        return get().tasks.filter((t) => !t.isCompleted);
      },

      getCompletedTasks: () => {
        return get().tasks.filter((t) => t.isCompleted);
      },

      resetParent: () => set(initialState),
    }),
    {
      name: 'parent-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
