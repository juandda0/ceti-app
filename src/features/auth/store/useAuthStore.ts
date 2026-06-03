import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useLessonsStore } from '@features/learning/store/useLessonsStore';
import { useQuestionBankStore } from '@features/learning/store/useQuestionBankStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useWalletStore } from '@features/savings/store/useWalletStore';
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
  sedeId: string | null;
  studentId: string | null;
  cursoId: string | null;
  superadmin: boolean;
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
  sedeId: null,
  studentId: null,
  cursoId: null,
  superadmin: false,
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
          sedeId: claims?.sedeId ?? null,
          studentId: claims?.studentId ?? null,
          cursoId: claims?.cursoId ?? null,
          superadmin: claims?.superadmin ?? false,
        }),

      resetSessionFlagsFromFirebase: () =>
        set({
          isAuthenticated: false,
          lastLogin: null,
          firebaseUid: null,
          role: null,
          colegioId: null,
          sedeId: null,
          studentId: null,
          cursoId: null,
          superadmin: false,
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
        useQuestionBankStore.getState().resetUserProgress();
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
        sedeId: null,
        studentId: null,
        cursoId: null,
        superadmin: false,
      }),
    }
  )
);

/** True for rector/coordinador/profesor (school staff), false for estudiante/none. */
export function isStaffRole(role: Role | null): boolean {
  return role != null && (STAFF_ROLES as readonly string[]).includes(role);
}

/** Hook: current role, or null if unprovisioned. */
export const useRole = (): Role | null => useAuthStore((s) => s.role);

/** Hook: whether the signed-in user is school staff. */
export const useIsStaff = (): boolean => useAuthStore((s) => isStaffRole(s.role));

/** Hook: whether the signed-in user is a platform super-admin. */
export const useIsSuperAdmin = (): boolean => useAuthStore((s) => s.superadmin);
