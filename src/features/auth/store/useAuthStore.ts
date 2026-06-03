import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useLessonsStore } from '@features/learning/store/useLessonsStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useWalletStore } from '@features/savings/store/useWalletStore';

interface AuthState {
  isAuthenticated: boolean;
  lastLogin: number | null;
  authReady: boolean;
  firebaseUid: string | null;
}

interface AuthActions {
  login: () => void;
  logout: () => Promise<void>;
  resetSessionFlagsFromFirebase: () => void;
  markAuthReady: () => void;
  setFirebaseUid: (uid: string | null) => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  isAuthenticated: false,
  lastLogin: null,
  authReady: false,
  firebaseUid: null,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,

      login: () =>
        set({
          isAuthenticated: true,
          lastLogin: Date.now(),
        }),

      markAuthReady: () => set({ authReady: true }),

      setFirebaseUid: (uid) => set({ firebaseUid: uid }),

      resetSessionFlagsFromFirebase: () =>
        set({
          isAuthenticated: false,
          lastLogin: null,
          firebaseUid: null,
        }),

      logout: async () => {
        try {
          const sync = await import('@shared/session/userRemoteSync');
          sync.stopUserRemoteSync();
        } catch {
          /* noop */
        }
        try {
          const push = await import('@shared/session/userProgressPush');
          await push.flushUserProgressPush();
        } catch {
          /* noop */
        }
        useSavingsStore.getState().resetSavings();
        useWalletStore.getState().resetWallet();
        useLessonsStore.getState().resetLessons();
        useUserStore.getState().resetUser();
        try {
          const m = await import('@shared/lib/firebase/authSession');
          await m.signOutFirebaseSession();
        } catch {
          /* noop */
        }
        set({ ...initialState, authReady: true });
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
      partialize: (state) => ({
        lastLogin: state.lastLogin,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        authReady: false,
        firebaseUid: null,
        isAuthenticated: false,
      }),
    }
  )
);
