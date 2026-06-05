---
name: add-zustand-mmkv-store
description: Use when the user asks to create a new Zustand store, add MMKV-persisted state, or introduce a new shared client-state slice. Generates a store under `src/features/{domain}/store/` or `src/shared/store/` following the project's persist + MMKV + selector conventions. Triggers: "add a store for X", "persist Y to MMKV", "new Zustand slice".
---

# Add a Zustand + MMKV store

Ceti has 7 stores following the exact same shape (`useAuthStore`, `useUserStore`, `useLessonsStore`, `useQuestionBankStore`, `useSavingsStore`, `useWalletStore`, `useThemeStore`). This skill makes new stores match.

## When to invoke

- A piece of state must be shared across unrelated components.
- Local persistence (across restarts) is desired.
- Local-only state — for remote/server state use a Firestore repository instead.

## Non-goals

- Do NOT cache Firestore data in a Zustand store unless there is a documented offline or draft-editing requirement.
- Do NOT persist OAuth tokens, raw PII, or long-lived auth state to MMKV. Firebase Auth handles its own AsyncStorage persistence via `getReactNativePersistence`.
- **Ningún campo con PII de menor se persiste a MMKV** (R4): nada de `email`/`nombre`/edad de un estudiante en estado persistido; auth/tokens los maneja Firebase Auth, no el store.
- Do NOT use bare `AsyncStorage` for store state — always go through `createZustandMmkvStorage`.

## Location

- Feature-scoped state → `src/features/<domain>/store/use<Name>Store.ts`
- Cross-feature state → `src/shared/store/use<Name>Store.ts`

## Steps

### 1. Define State and Actions interfaces

Keep state serializable. Functions, promises, sockets, and timers do NOT belong in state.

```ts
interface MyState {
  count: number;
  status: 'idle' | 'pending' | 'success' | 'error';
  items: string[];
}

interface MyActions {
  increment: () => void;
  reset: () => void;
  loadItems: () => Promise<void>;
}

type MyStore = MyState & MyActions;
```

### 2. Initial state as a named constant

`useUserStore`/`useAuthStore` both use this pattern so `reset` actions and tests can reuse it.

```ts
const initialState: MyState = {
  count: 0,
  status: 'idle',
  items: [],
};
```

### 3. Create the store with `persist` + MMKV

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';

export const useMyStore = create<MyStore>()(
  persist(
    (set) => ({
      ...initialState,

      increment: () => set((s) => ({ count: s.count + 1 })),
      reset: () => set({ ...initialState }),
      loadItems: async () => {
        set({ status: 'pending' });
        try {
          // ...local-only work
          set({ items: [], status: 'success' });
        } catch {
          set({ status: 'error' });
        }
      },
    }),
    {
      name: 'my-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
      partialize: (state) => ({
        count: state.count,
        items: state.items,
      }),
    }
  )
);
```

Required elements:

1. **`createZustandMmkvStorage()`** — no arguments. The MMKV instance is a project-wide singleton (`MMKV_ID = 'ceti-zustand'` in `src/shared/lib/storage/mmkv.ts`). The persist `name` is the key inside that singleton.
2. **Distinct `name`** — kebab-case, unique across the repo. Existing names: `auth-store`, `lessons-store`, `savings-store`, `wallet-store`, `ceti-theme-storage`, `question-bank-store`. Do not reuse.
3. **`partialize`** — explicitly list which fields to persist. Volatile fields (`status: 'pending'`, in-flight handles) must be excluded.
4. **`set((s) => ...)`** when the next value depends on the current one.
5. Reset action that returns to `initialState`.

### 4. Bump `version` + `migrate` when shape changes

```ts
{
  name: 'my-store',
  version: 2,
  migrate: (persisted, version) => {
    if (version < 2) {
      return { ...(persisted as MyState), newField: defaultValue };
    }
    return persisted as MyState;
  },
  ...
}
```

### 5. Consume with narrow selectors

In components, never call the store hook without a selector unless you truly need every field:

```ts
const count = useMyStore((s) => s.count);
const increment = useMyStore((s) => s.increment);

// Multiple values: use shallow
import { useShallow } from 'zustand/react/shallow';
const { count, items } = useMyStore(useShallow((s) => ({ count: s.count, items: s.items })));
```

### 6. Tests

Create `useMyStore.test.ts` next to the store. Follow the `useAuthStore.test.ts` pattern:

```ts
import { useMyStore } from '@features/<domain>/store/useMyStore';

describe('useMyStore', () => {
  beforeEach(() => {
    useMyStore.setState({ count: 0, status: 'idle', items: [] });
  });

  it('increment adds 1', () => {
    useMyStore.getState().increment();
    expect(useMyStore.getState().count).toBe(1);
  });
});
```

Do NOT render React in store tests when actions can be exercised directly.

## What this skill does NOT do

- It does not write the Firestore repository. For remote state use `add-firestore-repository`.
- It does not create a screen. For that use `add-screen`.
- It does not update `firestore.rules`.
