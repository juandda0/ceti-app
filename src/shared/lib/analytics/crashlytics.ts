/**
 * Crashlytics opcional: no-op si el módulo nativo no está disponible o en web.
 * El paquete @react-native-firebase/crashlytics llama a getApp() al importarse; solo
 * debe cargarse si existe una app nativa (p. ej. google-services / GoogleService-Info).
 */
import { Platform } from 'react-native';

type CrashModule = () => {
  recordError: (e: Error) => void;
  log: (m: string) => void;
  setUserId: (id: string) => void;
};

/** True si @react-native-firebase tiene apps nativas registradas (sin cargar crashlytics). */
export function isNativeFirebaseAppAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getApps } = require('@react-native-firebase/app') as { getApps: () => unknown[] };
    const apps = getApps();
    return Array.isArray(apps) && apps.length > 0;
  } catch {
    return false;
  }
}

function tryCrashlytics(): CrashModule | null {
  if (Platform.OS === 'web') return null;
  if (!isNativeFirebaseAppAvailable()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-firebase/crashlytics').default as CrashModule;
  } catch {
    return null;
  }
}

export function recordBoundaryError(error: Error, componentStack: string): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[crashlytics]', error.message, componentStack.slice(0, 200));
    return;
  }
  const crash = tryCrashlytics();
  if (!crash) return;
  try {
    const c = crash();
    c.log(`boundary: ${error.message}`);
    c.recordError(error);
  } catch {
    /* noop */
  }
}

export function setCrashlyticsUserId(uid: string | null): void {
  const crash = tryCrashlytics();
  if (!crash) return;
  try {
    crash().setUserId(uid && uid.length > 0 ? uid : 'anon');
  } catch {
    /* noop */
  }
}

export function recordError(error: unknown, context?: string): void {
  const err = error instanceof Error ? error : new Error(String(error));
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[crashlytics]', context ?? 'error', err.message);
    return;
  }
  const crash = tryCrashlytics();
  if (!crash) return;
  try {
    const c = crash();
    if (context) c.log(context);
    c.recordError(err);
  } catch {
    /* noop */
  }
}
