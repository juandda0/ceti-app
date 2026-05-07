import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useChildStore } from '@features/auth/store/useChildStore';
import { useChildrenRegistryStore } from '@features/auth/store/useChildrenRegistryStore';
import { useParentStore } from '@features/family/store/useParentStore';
import { useLessonsStore } from '@features/learning/store/useLessonsStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import { useWorldStore } from '@features/world/store/useWorldStore';
import { useThemeStore } from '@shared/store/useThemeStore';

import { migrateAsyncStorageToMmkvOnce } from '@shared/lib/storage/mmkv';

/** Hidrata todos los stores persistidos antes de decidir rutas (mitiga parpadeo). */
export async function rehydrateAllPersistedStores(): Promise<void> {
  await migrateAsyncStorageToMmkvOnce();
  await Promise.all([
    useAuthStore.persist.rehydrate(),
    useChildStore.persist.rehydrate(),
    useChildrenRegistryStore.persist.rehydrate(),
    useParentStore.persist.rehydrate(),
    useLessonsStore.persist.rehydrate(),
    useSavingsStore.persist.rehydrate(),
    useWalletStore.persist.rehydrate(),
    useWorldStore.persist.rehydrate(),
    useThemeStore.persist.rehydrate(),
  ]);
}
