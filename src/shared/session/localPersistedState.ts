import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useLessonsStore } from '@features/learning/store/useLessonsStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useWalletStore } from '@features/savings/store/useWalletStore';

export function resetUserScopedPersistedState(): void {
  useSavingsStore.getState().resetSavings();
  useWalletStore.getState().resetWallet();
  useLessonsStore.getState().resetLessons();
  useUserStore.getState().resetUser();
}

export async function resetAllLocalPersistedStateAndLogout(): Promise<void> {
  resetUserScopedPersistedState();
  await useAuthStore.getState().logout();
}
