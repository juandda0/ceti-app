/**
 * useLearningFlowStore — tracks per-user, per-world learning flow state.
 *
 * Persists to MMKV (no PII — only uid + worldId booleans, R4).
 *
 * Currently tracks:
 *  - seenMicroteoria: set of `${uid}:${worldId}` keys marking that the student
 *    has seen the micro-theory cards for a world at least once.
 *
 * Decision: micro-teoria is shown ONLY on the first entry to a world for a
 * given student (seenMicroteoria set guards subsequent entries). The student
 * can always re-access it in a future "review" UX, but for the initial flow we
 * show it once so the quiz is not blocked on every retry.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';

interface LearningFlowState {
  /** Set of `${uid}:${worldId}` keys. Serialised as an array for JSON compat. */
  seenMicroteoriaKeys: string[];
}

interface LearningFlowActions {
  markMicroteoriaSeen: (uid: string, worldId: string) => void;
  hasMicroteoriaSeen: (uid: string, worldId: string) => boolean;
  resetForUser: (uid: string) => void;
  /** Full clear on logout/user switch — robust against the demo/local uid
   * fallback collapsing distinct users to the same key. */
  reset: () => void;
}

type LearningFlowStore = LearningFlowState & LearningFlowActions;

const initialState: LearningFlowState = {
  seenMicroteoriaKeys: [],
};

export const useLearningFlowStore = create<LearningFlowStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      markMicroteoriaSeen: (uid, worldId) => {
        const key = `${uid}:${worldId}`;
        if (!get().seenMicroteoriaKeys.includes(key)) {
          set((s) => ({ seenMicroteoriaKeys: [...s.seenMicroteoriaKeys, key] }));
        }
      },

      hasMicroteoriaSeen: (uid, worldId) => {
        const key = `${uid}:${worldId}`;
        return get().seenMicroteoriaKeys.includes(key);
      },

      /** Remove all entries for this uid. */
      resetForUser: (uid) => {
        set((s) => ({
          seenMicroteoriaKeys: s.seenMicroteoriaKeys.filter((k) => !k.startsWith(`${uid}:`)),
        }));
      },

      reset: () => set({ seenMicroteoriaKeys: [] }),
    }),
    {
      name: 'learning-flow-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
      partialize: (state) => ({
        seenMicroteoriaKeys: state.seenMicroteoriaKeys,
      }),
    }
  )
);
