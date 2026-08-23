import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useMovimientosStore } from '@features/savings/store/useMovimientosStore';
import { usePresupuestosStore } from '@features/savings/store/usePresupuestosStore';
import { useThemeStore } from '@shared/store/useThemeStore';
import { migrateAsyncStorageToMmkvOnce } from '@shared/lib/storage/mmkv';

export async function rehydrateAllPersistedStores(): Promise<void> {
  await migrateAsyncStorageToMmkvOnce();
  await Promise.all([
    useAuthStore.persist.rehydrate(),
    useUserStore.persist.rehydrate(),
    useSavingsStore.persist.rehydrate(),
    useMovimientosStore.persist.rehydrate(),
    usePresupuestosStore.persist.rehydrate(),
    useThemeStore.persist.rehydrate(),
  ]);
}
