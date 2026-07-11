import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useQuestionBankStore } from '@features/learning/store/useQuestionBankStore';
import { useLearningFlowStore } from '@features/learning/store/useLearningFlowStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { STAFF_ROLES, type CetiClaims, type Role } from '@shared/types/tenancy';

interface AuthState {
  isAuthenticated: boolean;
  lastLogin: number | null;
  authReady: boolean;
  firebaseUid: string | null;
  // Tenancy/role mirrored from the Auth token (see lib/firebase/claims.ts).
  // Authoritative source is always the token; these are for routing/UI only.
  role: Role | null;
  colegioId: string | null;
  cursoId: string | null;
}

interface AuthActions {
  login: () => void;
  logout: () => Promise<void>;
  resetSessionFlagsFromFirebase: () => void;
  markAuthReady: () => void;
  setFirebaseUid: (uid: string | null) => void;
  setClaims: (claims: CetiClaims | null) => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  isAuthenticated: false,
  lastLogin: null,
  authReady: false,
  firebaseUid: null,
  role: null,
  colegioId: null,
  cursoId: null,
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

      setClaims: (claims) =>
        set({
          role: claims?.role ?? null,
          colegioId: claims?.colegioId ?? null,
          cursoId: claims?.cursoId ?? null,
        }),

      resetSessionFlagsFromFirebase: () =>
        set({
          isAuthenticated: false,
          lastLogin: null,
          firebaseUid: null,
          role: null,
          colegioId: null,
          cursoId: null,
        }),

      logout: async () => {
        try {
          const { loginIntent } = await import('@features/auth/data/loginIntent');
          loginIntent.clear();
        } catch {
          /* noop */
        }
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
        useQuestionBankStore.getState().resetUserProgress();
        useLearningFlowStore.getState().reset();
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
        role: null,
        colegioId: null,
        cursoId: null,
      }),
    }
  )
);

/** True for profesor (the only in-app staff role), false for estudiante/admin/none. */
export function isStaffRole(role: Role | null): boolean {
  return role != null && (STAFF_ROLES as readonly string[]).includes(role);
}

/** Hook: whether the signed-in user is the platform admin Ceti (role claim — R3). */
export const useIsAdmin = (): boolean => useAuthStore((s) => s.role === 'admin');
