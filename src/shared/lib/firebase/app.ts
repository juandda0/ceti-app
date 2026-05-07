import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
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

/** Inicializa Firebase (JS SDK). Sin EXPO_PUBLIC_* configurados, devuelve null (modo solo local). */
export function getFirebaseClients(): FirebaseClients | null {
  if (cached) return cached;
  const cfg = readFirebaseConfigFromExpo();
  if (!cfg) return null;
  const app = getApps().length ? getApps()[0]! : initializeApp(cfg);
  cached = {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
  };
  return cached;
}

export function isFirebaseConfigured(): boolean {
  return readFirebaseConfigFromExpo() !== null;
}
