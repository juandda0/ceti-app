/**
 * MMKV para persistencia Zustand (lecturas rápidas). En web se usa AsyncStorage.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

const MMKV_ID = 'ceti-zustand';

let mmkvSingleton: MMKV | null | undefined;

export function getAppMmkv(): MMKV | null {
  if (Platform.OS === 'web') return null;
  if (mmkvSingleton !== undefined) return mmkvSingleton;
  try {
    mmkvSingleton = new MMKV({ id: MMKV_ID });
  } catch {
    mmkvSingleton = null;
  }
  return mmkvSingleton;
}

/** Storage compatible con `persist(createJSONStorage(() => …))` */
export function createZustandMmkvStorage(): StateStorage {
  const mmkv = getAppMmkv();
  if (mmkv) {
    return {
      getItem: (name) => Promise.resolve(mmkv.getString(name) ?? null),
      setItem: (name, value) => {
        mmkv.set(name, value);
        return Promise.resolve();
      },
      removeItem: (name) => {
        mmkv.delete(name);
        return Promise.resolve();
      },
    };
  }
  return {
    getItem: (name) => AsyncStorage.getItem(name),
    setItem: (name, value) => AsyncStorage.setItem(name, value),
    removeItem: (name) => AsyncStorage.removeItem(name),
  };
}

/** Claves `persist.name` de Zustand que antes vivían en AsyncStorage. */
export const ZUSTAND_PERSIST_KEYS = [
  'auth-store',
  'child-store',
  'children-registry',
  'parent-store',
  'lessons-store',
  'savings-store',
  'wallet-store',
  'world-store',
  'ceti-theme-storage',
] as const;

const MIGRATION_FLAG = '__ceti_migrated_async_storage_v1';

/** Copia one-shot desde AsyncStorage a MMKV antes de rehidratar. */
export async function migrateAsyncStorageToMmkvOnce(): Promise<void> {
  const mmkv = getAppMmkv();
  if (!mmkv) return;
  if (mmkv.getString(MIGRATION_FLAG) === '1') return;

  for (const key of ZUSTAND_PERSIST_KEYS) {
    try {
      const v = await AsyncStorage.getItem(key);
      if (v != null && (mmkv.getString(key) == null || mmkv.getString(key) === '')) {
        mmkv.set(key, v);
      }
    } catch {
      /* noop */
    }
  }
  mmkv.set(MIGRATION_FLAG, '1');
}
