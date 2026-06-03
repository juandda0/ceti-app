import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import Constants from 'expo-constants';

export type FirebaseClients = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
};

let cached: FirebaseClients | null = null;

function readFirebaseConfigFromExpo(): {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
} | null {
  const extra = Constants.expoConfig?.extra as { firebase?: Record<string, string> } | undefined;
  const f = extra?.firebase;
  if (!f?.apiKey || !f.projectId) return null;
  return {
    apiKey: f.apiKey,
    authDomain: f.authDomain ?? '',
    projectId: f.projectId,
    storageBucket: f.storageBucket ?? '',
    messagingSenderId: f.messagingSenderId ?? '',
    appId: f.appId ?? '',
    measurementId: f.measurementId,
  };
}

function initAuthWithPersistence(app: FirebaseApp): Auth {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e: unknown) {
    const code =
      e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : '';
    if (code === 'auth/already-initialized') {
      return getAuth(app);
    }
    throw e;
  }
}

function initFirestoreWithLongPolling(app: FirebaseApp): Firestore {
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : '';
    if (msg.includes('already been initialized') || msg.includes('already initialized')) {
      return getFirestore(app);
    }
    return getFirestore(app);
  }
}

/** Inicializa Firebase (JS SDK). Sin EXPO_PUBLIC_* configurados, devuelve null (modo solo local). */
export function getFirebaseClients(): FirebaseClients | null {
  if (cached) return cached;
  const cfg = readFirebaseConfigFromExpo();
  if (!cfg) return null;
  const app = getApps().length ? getApps()[0]! : initializeApp(cfg);
  cached = {
    app,
    auth: initAuthWithPersistence(app),
    firestore: initFirestoreWithLongPolling(app),
  };
  return cached;
}

export function isFirebaseConfigured(): boolean {
  return readFirebaseConfigFromExpo() !== null;
}
