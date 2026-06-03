import type { Href, Router } from 'expo-router';
import { useAuthStore } from '@features/auth/store/useAuthStore';

/**
 * Cierra sesión (stores + Firebase OAuth) y redirige. Un solo punto de salida.
 */
export async function performLogoutAndGo(
  router: Router,
  target: Href = '/(auth)/welcome'
): Promise<void> {
  // Don't let a stalled background flush/sign-out block navigation on web.
  await Promise.race([
    useAuthStore
      .getState()
      .logout()
      .catch(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, 1500)),
  ]);
  router.replace(target);
}
