import type { Href, Router } from 'expo-router';
import { useAuthStore } from '@features/auth/store/useAuthStore';

/**
 * Cierra sesión (stores + Firebase OAuth) y redirige. Un solo punto de salida.
 */
export async function performLogoutAndGo(
  router: Router,
  target: Href = '/(auth)/welcome'
): Promise<void> {
  // Navigate FIRST, then tear down. Resetting the auth store flips role
  // to null, which makes the (staff)/(app) layout guards render a <Redirect>; if
  // that happens while we also call router.replace(), the two competing
  // navigations crash React Navigation on web. Leaving the guarded group before
  // the reset avoids the race — the reset then runs harmlessly on the auth stack.
  router.replace(target);
  // Don't let a stalled background flush/sign-out block anything on web.
  await Promise.race([
    useAuthStore
      .getState()
      .logout()
      .catch(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, 1500)),
  ]);
}
