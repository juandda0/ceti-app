import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import { useThemeStore } from '@shared/store/useThemeStore';
import { migrateAsyncStorageToMmkvOnce } from '@shared/lib/storage/mmkv';

export async function rehydrateAllPersistedStores(): Promise<void> {
  await migrateAsyncStorageToMmkvOnce();
  await Promise.all([
    useAuthStore.persist.rehydrate(),
    useUserStore.persist.rehydrate(),
    useSavingsStore.persist.rehydrate(),
    useWalletStore.persist.rehydrate(),
    useThemeStore.persist.rehydrate(),
  ]);
}
