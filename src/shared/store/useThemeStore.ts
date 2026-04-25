import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark', // Default is dark
      toggleTheme: () => set((state) => ({ mode: state.mode === 'light' ? 'dark' : 'light' })),
      setTheme: (mode) => set({ mode }),
    }),
    {
      name: 'ceti-theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
