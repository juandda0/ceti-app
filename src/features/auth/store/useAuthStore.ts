import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useQuestionBankStore } from '@features/learning/store/useQuestionBankStore';
import { useLearningFlowStore } from '@features/learning/store/useLearningFlowStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useMovimientosStore } from '@features/savings/store/useMovimientosStore';
import { STAFF_ROLES, type CetiClaims, type Role } from '@shared/types/tenancy';

interface AuthState {
  isAuthenticated: boolean;
  lastLogin: number | null;
  authReady: boolean;
  /** Id de la cuenta en el backend. */
  uid: string | null;
  // Rol/tenant reflejados de la cuenta (ver lib/auth/session.ts). La fuente
  // autoritativa es siempre el servidor; aquí solo enrutan la UI.
  role: Role | null;
  colegioId: string | null;
  cursoId: string | null;
}

interface AuthActions {
  login: () => void;
  logout: () => Promise<void>;
  resetSession: () => void;
  markAuthReady: () => void;
  setUid: (uid: string | null) => void;
  setClaims: (claims: CetiClaims | null) => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  isAuthenticated: false,
  lastLogin: null,
  authReady: false,
  uid: null,
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

      setUid: (uid) => set({ uid }),

      setClaims: (claims) =>
        set({
          role: claims?.role ?? null,
          colegioId: claims?.colegioId ?? null,
          cursoId: claims?.cursoId ?? null,
        }),

      resetSession: () =>
        set({
          isAuthenticated: false,
          lastLogin: null,
          uid: null,
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
        useSavingsStore.getState().resetSavings();
        // El diario de bolsillo es PII financiera del menor (Ley 1581): sin este
        // reset, la siguiente cuenta en el mismo navegador vería los movimientos
        // de la anterior (no hay lectura remota que los reemplace por uid).
        useMovimientosStore.getState().resetMovimientos();
        useQuestionBankStore.getState().resetUserProgress();
        useLearningFlowStore.getState().reset();
        useUserStore.getState().resetUser();
        try {
          const m = await import('@shared/lib/auth/authSession');
          await m.signOutSession();
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
        uid: null,
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
