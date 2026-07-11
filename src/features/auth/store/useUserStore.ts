import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';

export interface UserState {
  id: string;
  nickname: string;
  fullName: string;
  avatarId: string;
  avatarEmoji: string;
  isOnboarded: boolean;
}

interface UserActions {
  setProfile: (nickname: string, fullName: string, avatarId: string, avatarEmoji: string) => void;
  loadProfile: (profile: Partial<UserState>) => void;
  resetUser: () => void;
}

type UserStore = UserState & UserActions;

function ensureId(existing: string | undefined): string {
  const t = (existing ?? '').trim();
  if (t.length > 0) return t;
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

const initialState: UserState = {
  id: '',
  nickname: '',
  fullName: '',
  avatarId: '',
  avatarEmoji: '',
  isOnboarded: false,
};

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      ...initialState,

      setProfile: (nickname, fullName, avatarId, avatarEmoji) => {
        set((state) => ({
          ...state,
          id: ensureId(state.id),
          nickname,
          fullName,
          avatarId,
          avatarEmoji,
          isOnboarded: true,
        }));
      },

      loadProfile: (profile) => {
        set((state) => ({
          ...state,
          ...profile,
          id: ensureId((profile.id ?? state.id) as string),
          isOnboarded: true,
        }));
      },

      resetUser: () => set(initialState),
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
      merge: (persistedState, currentState) => {
        const p = (persistedState ?? {}) as Partial<UserState>;
        const persistedId =
          typeof p.id === 'string' && p.id.trim().length > 0
            ? p.id.trim()
            : ensureId(currentState.id);
        return { ...currentState, ...p, id: persistedId } as UserStore;
      },
    }
  )
);
