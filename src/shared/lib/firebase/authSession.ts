import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { getFirebaseClients, isFirebaseConfigured } from '@shared/lib/firebase/app';
import { signOutOAuthProviders } from '@shared/lib/firebase/oauth';
import { useAuthStore } from '@features/auth/store/useAuthStore';

import { setCrashlyticsUserId } from '@shared/lib/analytics/crashlytics';

let authUnsubscribe: (() => void) | null = null;

function applyUser(user: User | null) {
  useAuthStore.getState().setFirebaseUid(user?.uid ?? null);
  setCrashlyticsUserId(user?.uid ?? null);
}

/**
 * Suscripción a Firebase Auth. No inicia sesión anónima: el login es OAuth (Google / Apple).
 */
export async function initFirebaseAuthSession(): Promise<void> {
  if (!isFirebaseConfigured()) {
    useAuthStore.getState().markAuthReady();
    return;
  }

  const clients = getFirebaseClients();
  if (!clients) {
    useAuthStore.getState().markAuthReady();
    return;
  }

  authUnsubscribe?.();
  authUnsubscribe = onAuthStateChanged(clients.auth, (user) => {
    applyUser(user);
  });

  applyUser(clients.auth.currentUser);
  useAuthStore.getState().markAuthReady();

  if (clients.auth.currentUser) {
    void import('@shared/lib/analytics/logEvent')
      .then((m) => m.logEvent('session_start', { oauth: true }))
      .catch(() => {});
  }
}

/** Cierra la sesión Firebase (p. ej. al hacer logout local completo). */
export async function signOutFirebaseSession(): Promise<void> {
  const clients = getFirebaseClients();
  if (!clients?.auth) {
    applyUser(null);
    return;
  }
  try {
    await signOutOAuthProviders();
  } catch {
    /* noop */
  }
  try {
    if (clients.auth.currentUser) {
      await signOut(clients.auth);
    }
  } catch {
    /* noop */
  }
  applyUser(null);
}
