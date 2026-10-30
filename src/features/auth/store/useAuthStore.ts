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
  firebaseUid: string | null;
  // Tenancy/role mirrored from the Auth token (see lib/firebase/claims.ts).
  // Authoritative source is always the token; these are for routing/UI only.
  role: Role | null;
  /**
   * Teacher: their colegio. Student: the class of the active space (null in
   * "Mi galaxia"), so every student screen reads the space it is showing.
   */
  colegioId: string | null;
  cursoId: string | null;
  /** Student only: their classes {cursoId: colegioId} (up to 5). */
  clases: Record<string, string>;
  /** Student only: the class whose space is open in Aprender; null = Mi galaxia. */
  espacio: string | null;
  /** The student picked a space at least once (else a class opens by default). */
  espacioElegido: boolean;
}

interface AuthActions {
  login: () => void;
  logout: () => Promise<void>;
  resetSessionFlagsFromFirebase: () => void;
  markAuthReady: () => void;
  setFirebaseUid: (uid: string | null) => void;
  setClaims: (claims: CetiClaims | null) => void;
  /** Opens a class space (cursoId) or "Mi galaxia" (null). Ignores unknown classes. */
  setEspacio: (cursoId: string | null) => void;
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
  clases: {},
  espacio: null,
  espacioElegido: false,
};

/** colegioId/cursoId a student screen should read for the given space. */
function aulaDelEspacio(
  clases: Record<string, string>,
  espacio: string | null
): Pick<AuthState, 'colegioId' | 'cursoId' | 'espacio'> {
  if (espacio && clases[espacio]) {
    return { colegioId: clases[espacio], cursoId: espacio, espacio };
  }
  return { colegioId: null, cursoId: null, espacio: null };
}

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
        set((s) => {
          if (claims?.role === 'estudiante') {
            const clases = claims.clases ?? {};
            // Sin elección previa, Aprender abre en su (primera) clase.
            const espacio = s.espacioElegido ? s.espacio : (Object.keys(clases)[0] ?? null);
            return { role: 'estudiante', clases, ...aulaDelEspacio(clases, espacio) };
          }
          return {
            role: claims?.role ?? null,
            colegioId: claims?.colegioId ?? null,
            cursoId: claims?.cursoId ?? null,
            clases: {},
          };
        }),

      setEspacio: (cursoId) =>
        set((s) =>
          s.role === 'estudiante'
            ? { ...aulaDelEspacio(s.clases, cursoId), espacioElegido: true }
            : {}
        ),

      resetSessionFlagsFromFirebase: () =>
        set({
          isAuthenticated: false,
          lastLogin: null,
          firebaseUid: null,
          role: null,
          colegioId: null,
          cursoId: null,
          clases: {},
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
        // El diario de bolsillo es PII financiera del menor (Ley 1581): sin este
        // reset, la siguiente cuenta en el mismo navegador vería los movimientos
        // de la anterior (no hay lectura remota que los reemplace por uid).
        useMovimientosStore.getState().resetMovimientos();
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
        // El último espacio abierto en Aprender (se valida contra las clases del token).
        espacio: state.espacio,
        espacioElegido: state.espacioElegido,
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
        clases: {},
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
