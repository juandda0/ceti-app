/**
 * Orquestación del estado persistido en dispositivo (caché + AsyncStorage).
 * Fase local / sin backend: un solo lugar para reinicios evita dejar stores huérfanas.
 *
 * Convención:
 * - `resetAllLocalPersistedStateAndLogout` — fábrica total (como “Reiniciar ecosistema”).
 * - `resetChildScopedPersistedState` — nuevo perfil infantil en el mismo dispositivo sin borrar PIN/padre.
 */

import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useChildStore } from '@features/auth/store/useChildStore';
import { useLessonsStore } from '@features/learning/store/useLessonsStore';
import { useParentStore } from '@features/family/store/useParentStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import { useWorldStore } from '@features/world/store/useWorldStore';

export function resetChildScopedPersistedState(): void {
  useSavingsStore.getState().resetSavings();
  useWalletStore.getState().resetWallet();
  useLessonsStore.getState().resetLessons();
  useWorldStore.getState().resetWorld();
  useChildStore.getState().resetChild();
}

export function resetAllLocalPersistedStateAndLogout(): void {
  resetChildScopedPersistedState();
  useParentStore.getState().resetParent();
  useAuthStore.setState({
    isAuthenticated: false,
    userRole: null,
    lastLogin: null,
  });
}
