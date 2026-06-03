import type { Href, Router } from 'expo-router';
import { useAuthStore } from '@features/auth/store/useAuthStore';

/**
 * Cierra sesión (stores + Firebase OAuth) y redirige. Un solo punto de salida.
 */
export async function performLogoutAndGo(
  router: Router,
  target: Href = '/(auth)/welcome'
): Promise<void> {
  await useAuthStore.getState().logout();
  router.replace(target);
}
