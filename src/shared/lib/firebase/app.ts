import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import Constants from 'expo-constants';

export type FirebaseClients = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
};

let cached: FirebaseClients | null = null;

/**
 * Salón demo (docs/salon-demo.md): con `EXPO_PUBLIC_USE_EMULATORS=1` la app usa
 * los emuladores locales de Auth, Firestore y Functions. Sin la variable, nada
 * cambia.
 */
export const USA_EMULADORES = process.env.EXPO_PUBLIC_USE_EMULATORS === '1';
/** Proyecto `demo-*`: los emuladores nunca intentan hablar con un proyecto real. */
export const PROYECTO_EMULADOR = 'demo-ceti';
/** Deben coincidir con el bloque `emulators` de firebase.json. */
const PUERTOS_EMULADOR = { auth: 9098, firestore: 8099, functions: 5001 } as const;

type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

function readFirebaseConfig(): FirebaseWebConfig | null {
  const cfg = readFirebaseConfigFromExpo();
  if (!USA_EMULADORES) return cfg;
  // El emulador de Auth acepta cualquier apiKey; el proyecto debe ser el demo.
  return {
    apiKey: cfg?.apiKey || 'demo-api-key',
    authDomain: `${PROYECTO_EMULADOR}.firebaseapp.com`,
    projectId: PROYECTO_EMULADOR,
    storageBucket: '',
    messagingSenderId: cfg?.messagingSenderId ?? '',
    appId: cfg?.appId ?? '',
  };
}

/**
 * Host de los emuladores: el de la página en web (sirve en localhost, en
 * subdominios *.localhost del salón y desde otro equipo de la red); en nativo,
 * el del servidor de Metro.
 */
function hostEmuladores(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const h = window.location.hostname;
    // 127.0.0.x (alternativa del salón a *.localhost): los emuladores escuchan en 127.0.0.1.
    return /^127\./.test(h) ? '127.0.0.1' : h;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return host;
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
}

/** Distintivo fijo "EMULADOR" en web, para no confundirlo con producción. */
function mostrarDistintivoEmulador(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const poner = () => {
    if (document.getElementById('ceti-distintivo-emulador')) return;
    const el = document.createElement('div');
    el.id = 'ceti-distintivo-emulador';
    el.textContent = 'EMULADOR';
    Object.assign(el.style, {
      position: 'fixed',
      left: '6px',
      bottom: '6px',
      zIndex: '2147483647',
      padding: '2px 6px',
      borderRadius: '6px',
      background: 'rgba(234, 88, 12, 0.92)',
      color: '#fff',
      font: '700 9px/1.4 system-ui, sans-serif',
      letterSpacing: '0.08em',
      pointerEvents: 'none',
    });
    document.body.appendChild(el);
  };
  if (document.body) poner();
  else document.addEventListener('DOMContentLoaded', poner);
}

function conectarEmuladores(clients: FirebaseClients): void {
  const host = hostEmuladores();
  connectAuthEmulator(clients.auth, `http://${host}:${PUERTOS_EMULADOR.auth}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(clients.firestore, host, PUERTOS_EMULADOR.firestore);
  // Misma instancia que usa callFunction (getFunctions cachea por región).
  connectFunctionsEmulator(
    getFunctions(clients.app, 'us-central1'),
    host,
    PUERTOS_EMULADOR.functions
  );
  mostrarDistintivoEmulador();
}

function readFirebaseConfigFromExpo(): FirebaseWebConfig | null {
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
  const cfg = readFirebaseConfig();
  if (!cfg) return null;
  const app = getApps().length ? getApps()[0]! : initializeApp(cfg);
  cached = {
    app,
    auth: initAuthWithPersistence(app),
    firestore: initFirestoreWithLongPolling(app),
  };
  if (USA_EMULADORES) conectarEmuladores(cached);
  return cached;
}

export function isFirebaseConfigured(): boolean {
  return readFirebaseConfig() !== null;
}
