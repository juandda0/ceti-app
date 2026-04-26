import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'parent' | 'child' | null;

interface AuthState {
  isAuthenticated: boolean;
  userRole: UserRole;
  lastLogin: number | null;
}

interface AuthActions {
  loginAsParent: () => void;
  loginAsChild: () => void;
  logout: () => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  isAuthenticated: false,
  userRole: null,
  lastLogin: null,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,

      loginAsParent: () => set({ 
        isAuthenticated: true, 
        userRole: 'parent', 
        lastLogin: Date.now() 
      }),

      loginAsChild: () => set({ 
        isAuthenticated: true, 
        userRole: 'child', 
        lastLogin: Date.now() 
      }),

      logout: () => set(initialState),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
