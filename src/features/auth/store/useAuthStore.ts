import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import { useChildStore } from '@features/auth/store/useChildStore';
import { useParentStore } from '@features/family/store/useParentStore';
import { useLessonsStore } from '@features/learning/store/useLessonsStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import { useWorldStore } from '@features/world/store/useWorldStore';

/**
 * Sesión local (rol + flags) + Firebase Auth opcional cuando `extra.firebase` está configurado.
 */

export type UserRole = 'parent' | 'child' | null;

interface AuthState {
  isAuthenticated: boolean;
  userRole: UserRole;
  lastLogin: number | null;
  /** `false` hasta terminar hidratación + `initFirebaseAuthSession` (o ausencia de Firebase). */
  authReady: boolean;
  firebaseUid: string | null;
  /** Familia enlazada (perfil niño en dispositivo del hijo). */
  linkedFamilyId: string | null;
}

interface AuthActions {
  loginAsParent: () => void;
  loginAsChild: () => void;
  logout: () => void;
  markAuthReady: () => void;
  setFirebaseUid: (uid: string | null) => void;
  setLinkedFamilyId: (familyId: string | null) => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  isAuthenticated: false,
  userRole: null,
  lastLogin: null,
  authReady: false,
  firebaseUid: null,
  linkedFamilyId: null,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      loginAsParent: () =>
        set({
          isAuthenticated: true,
          userRole: 'parent',
          lastLogin: Date.now(),
        }),

      loginAsChild: () =>
        set({
          isAuthenticated: true,
          userRole: 'child',
          lastLogin: Date.now(),
        }),

      markAuthReady: () => set({ authReady: true }),

      setFirebaseUid: (uid) => set({ firebaseUid: uid }),

      setLinkedFamilyId: (familyId) => set({ linkedFamilyId: familyId }),

      logout: () => {
        void import('@shared/session/firestoreSync')
          .then((m) => m.stopFamilyChildrenRemoteSync())
          .catch(() => {});
        const role = get().userRole;
        if (role === 'child') {
          useSavingsStore.getState().resetSavings();
          useWalletStore.getState().resetWallet();
          useLessonsStore.getState().resetLessons();
          useWorldStore.getState().resetWorld();
          useChildStore.getState().resetChild();
        } else if (role === 'parent') {
          useParentStore.getState().resetParent();
        }
        void import('@shared/lib/firebase/authSession')
          .then((m) => m.signOutFirebaseSession())
          .catch(() => {});
        set({ ...initialState, authReady: true });
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        userRole: state.userRole,
        lastLogin: state.lastLogin,
        linkedFamilyId: state.linkedFamilyId,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        authReady: false,
        firebaseUid: null,
      }),
    }
  )
);
