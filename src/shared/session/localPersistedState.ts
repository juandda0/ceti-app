import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useWalletStore } from '@features/savings/store/useWalletStore';

export function resetUserScopedPersistedState(): void {
  useSavingsStore.getState().resetSavings();
  useWalletStore.getState().resetWallet();
  useUserStore.getState().resetUser();
}

export async function resetAllLocalPersistedStateAndLogout(): Promise<void> {
  resetUserScopedPersistedState();
  await useAuthStore.getState().logout();
}
