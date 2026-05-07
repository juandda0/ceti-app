// store/useParentStore.ts — PIN (digest), tareas, configuración del padre
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import { hashParentPin } from '@features/auth/utils/pinCrypto';

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
  /** Legado: PIN en claro (migración a pinDigest). */
  pin: string;
  pinDigest: string;
  isPinSet: boolean;
  tasks: ParentTask[];
  parentName: string;
  /** Id estable de familia para Firestore / sync. */
  familyId: string;
}

interface ParentActions {
  ensureFamilyId: () => string;
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  setParentName: (name: string) => void;
  setFamilyId: (familyId: string) => void;
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

/** Rate-limit en memoria (no persistido) contra fuerza bruta del PIN. */
const PIN_ATTEMPT_MAX = 5;
const PIN_LOCK_MS = 60_000;
let pinAttemptFailures = 0;
let pinLockedUntil = 0;

const initialState: ParentState = {
  pin: '',
  pinDigest: '',
  isPinSet: false,
  tasks: [],
  parentName: '',
  familyId: '',
};

export const useParentStore = create<ParentStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      ensureFamilyId: () => {
        const cur = get().familyId.trim();
        if (cur) return cur;
        const nid = `fam_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
        set({ familyId: nid });
        return nid;
      },

      setPin: async (pin) => {
        get().ensureFamilyId();
        const digest = await hashParentPin(pin);
        set({ pin: '', pinDigest: digest, isPinSet: true });
      },

      verifyPin: async (pin) => {
        if (Date.now() < pinLockedUntil) return false;
        const { pinDigest, pin: legacy } = get();
        if (pinDigest) {
          const d = await hashParentPin(pin);
          const ok = d === pinDigest;
          if (!ok) {
            pinAttemptFailures += 1;
            if (pinAttemptFailures >= PIN_ATTEMPT_MAX) {
              pinLockedUntil = Date.now() + PIN_LOCK_MS;
              pinAttemptFailures = 0;
            }
            return false;
          }
          pinAttemptFailures = 0;
          return true;
        }
        const ok = legacy === pin;
        if (!ok) {
          pinAttemptFailures += 1;
          if (pinAttemptFailures >= PIN_ATTEMPT_MAX) {
            pinLockedUntil = Date.now() + PIN_LOCK_MS;
            pinAttemptFailures = 0;
          }
          return false;
        }
        pinAttemptFailures = 0;
        return true;
      },

      setParentName: (name) => {
        get().ensureFamilyId();
        set({ parentName: name });
      },

      setFamilyId: (familyId) => set({ familyId: familyId.trim() }),

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
            t.id === taskId ? { ...t, isCompleted: true, completedAt: Date.now() } : t
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

      resetParent: () =>
        set((s) => ({
          ...initialState,
          familyId: s.familyId,
        })),
    }),
    {
      name: 'parent-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
    }
  )
);
