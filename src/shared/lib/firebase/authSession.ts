import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseClients, isFirebaseConfigured } from '@shared/lib/firebase/app';
import { tryBootstrapUserDoc } from '@shared/lib/firebase/authProfileBootstrap';
import { FIRESTORE_COLLECTIONS } from '@shared/lib/firebase/paths';
import { signOutOAuthProviders } from '@shared/lib/firebase/oauth';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { setCrashlyticsUserId } from '@shared/lib/analytics/crashlytics';

let authUnsubscribe: (() => void) | null = null;
let firestoreUserUnsubscribe: (() => void) | null = null;

function applyUser(user: User | null) {
  useAuthStore.getState().setFirebaseUid(user?.uid ?? null);
  setCrashlyticsUserId(user?.uid ?? null);
}

function subscribeAuthUserFirestoreDoc(
  user: User,
  clients: NonNullable<ReturnType<typeof getFirebaseClients>>
) {
  firestoreUserUnsubscribe?.();
  const ref = doc(clients.firestore, FIRESTORE_COLLECTIONS.users, user.uid);
  firestoreUserUnsubscribe = onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) return;
      void tryBootstrapUserDoc(user);
    },
    (err) => {
      const msg = err.message ?? '';
      if (msg.includes('permission') || (err as { code?: string }).code === 'permission-denied') {
        return;
      }
    }
  );
}

/**
 * Subscribes to Firebase Auth. Login is OAuth (Google / Apple) only.
 * Watches `users/{uid}` to bootstrap missing profile docs.
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
    if (!user) {
      useAuthStore.getState().resetSessionFlagsFromFirebase();
    }
    firestoreUserUnsubscribe?.();
    firestoreUserUnsubscribe = null;
    if (user) {
      subscribeAuthUserFirestoreDoc(user, clients);
    }
  });

  applyUser(clients.auth.currentUser);
  if (clients.auth.currentUser) {
    subscribeAuthUserFirestoreDoc(clients.auth.currentUser, clients);
  }
  useAuthStore.getState().markAuthReady();

  if (clients.auth.currentUser) {
    void import('@shared/lib/analytics/logEvent')
      .then((m) => m.logEvent('session_start', { oauth: true }))
      .catch(() => {});
  }
}

/** Closes Firebase session (called on logout). */
export async function signOutFirebaseSession(): Promise<void> {
  firestoreUserUnsubscribe?.();
  firestoreUserUnsubscribe = null;
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
