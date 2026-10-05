import { useAuthStore } from '@features/auth/store/useAuthStore';
import { clearSession, getSessionUser, toCetiClaims } from '@shared/lib/auth/session';
import { signOutOAuthProviders } from '@shared/lib/auth/oauth';
import { recordError } from '@shared/lib/analytics/errorReporting';

/**
 * Arranque de la sesión: resuelve cuenta y rol ANTES de marcar el store listo,
 * para que los guards de grupo ((staff), (admin)) no reboten un deep link
 * recargado mientras el rol aún no se conoce. El enrutado fino sigue en
 * app/index.tsx. Sin red, el store queda listo sin cuenta y el index reintenta.
 */
export async function initAuthSession(): Promise<void> {
  try {
    const user = await getSessionUser();
    if (user) {
      useAuthStore.getState().setUid(user.id);
      useAuthStore.getState().setClaims(toCetiClaims(user));
    }
  } catch (e) {
    recordError(e, 'auth_session_init');
  }
  useAuthStore.getState().markAuthReady();
}

/** Cierra la sesión (logout): token propio + sesión Google nativa. */
export async function signOutSession(): Promise<void> {
  try {
    await signOutOAuthProviders();
  } catch (e) {
    recordError(e, 'oauth_sign_out');
  }
  await clearSession();
  useAuthStore.getState().setUid(null);
}
