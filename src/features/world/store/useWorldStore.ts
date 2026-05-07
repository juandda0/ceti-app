import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import type { WorldId } from '../data/worlds';

export interface WorldDecoration {
  id: string;
  type: 'flowers' | 'lamp' | 'fountain' | 'pet';
  position: { x: number; y: number; z: number };
  purchasedAt: number;
}

export type MinigameId = 'coinCatch' | 'saveOrSpend';

interface WorldState {
  currentWorldId: WorldId;
  unlockedWorldIds: WorldId[];
  decorations: WorldDecoration[];
  travelHistory: { worldId: WorldId; at: number }[];
  /** timestamps en ms en que el próximo cooldown expira (0 = disponible) */
  minigameCooldowns: Record<MinigameId, number>;
  /** conteo de interacciones para futuros logros */
  interactionCounts: Record<string, number>;
}

interface WorldActions {
  travelTo: (id: WorldId) => void;
  unlockWorld: (id: WorldId) => void;
  addDecoration: (decoration: Omit<WorldDecoration, 'purchasedAt'>) => void;
  setMinigameCooldown: (game: MinigameId, untilMs: number) => void;
  recordInteraction: (type: string) => void;
  resetWorld: () => void;
}

type WorldStore = WorldState & WorldActions;

const initialState: WorldState = {
  currentWorldId: 'rocky',
  unlockedWorldIds: ['rocky'],
  decorations: [],
  travelHistory: [],
  minigameCooldowns: { coinCatch: 0, saveOrSpend: 0 },
  interactionCounts: {},
};

export const useWorldStore = create<WorldStore>()(
  persist(
    (set) => ({
      ...initialState,

      travelTo: (id) =>
        set((s) => ({
          currentWorldId: id,
          travelHistory: [...s.travelHistory, { worldId: id, at: Date.now() }],
        })),

      unlockWorld: (id) =>
        set((s) => ({
          unlockedWorldIds: s.unlockedWorldIds.includes(id)
            ? s.unlockedWorldIds
            : [...s.unlockedWorldIds, id],
        })),

      addDecoration: (decoration) =>
        set((s) => ({
          decorations: [...s.decorations, { ...decoration, purchasedAt: Date.now() }],
        })),

      setMinigameCooldown: (game, untilMs) =>
        set((s) => ({
          minigameCooldowns: { ...s.minigameCooldowns, [game]: untilMs },
        })),

      recordInteraction: (type) =>
        set((s) => ({
          interactionCounts: {
            ...s.interactionCounts,
            [type]: (s.interactionCounts[type] ?? 0) + 1,
          },
        })),

      resetWorld: () => set(initialState),
    }),
    {
      name: 'world-store',
      version: 3,
      storage: createJSONStorage(() => createZustandMmkvStorage()),
      migrate: (persisted, version) => {
        const old = persisted as Partial<WorldState>;
        if (version < 2) {
          return {
            ...initialState,
            decorations: old.decorations ?? [],
          };
        }
        if (version < 3) {
          return {
            ...initialState,
            currentWorldId: old.currentWorldId ?? 'rocky',
            unlockedWorldIds: old.unlockedWorldIds ?? ['rocky'],
            decorations: old.decorations ?? [],
            travelHistory: old.travelHistory ?? [],
          };
        }
        return persisted as WorldStore;
      },
    }
  )
);
