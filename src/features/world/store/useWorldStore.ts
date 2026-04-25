// store/useWorldStore.ts — Estado del mundo 3D (Solo Decoraciones/Personajes)
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WorldDecoration {
  id: string;
  type: 'flowers' | 'lamp' | 'fountain' | 'pet';
  position: { x: number; y: number; z: number };
  purchasedAt: number;
}

interface WorldState {
  decorations: WorldDecoration[];
}

interface WorldActions {
  addDecoration: (decoration: Omit<WorldDecoration, 'purchasedAt'>) => void;
  resetWorld: () => void;
}

type WorldStore = WorldState & WorldActions;

const initialState: WorldState = {
  decorations: [],
};

export const useWorldStore = create<WorldStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addDecoration: (decoration) => {
        const fullDecoration: WorldDecoration = {
          ...decoration,
          purchasedAt: Date.now(),
        };
        set((state) => ({
          decorations: [...state.decorations, fullDecoration],
        }));
      },

      resetWorld: () => set(initialState),
    }),
    {
      name: 'world-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
