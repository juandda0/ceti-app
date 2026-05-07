/**
 * Crashlytics opcional: no-op si el módulo nativo no está disponible o en web.
 */
import { Platform } from 'react-native';

type CrashModule = () => {
  recordError: (e: Error) => void;
  log: (m: string) => void;
  setUserId: (id: string) => void;
};

function tryCrashlytics(): CrashModule | null {
  if (Platform.OS === 'web') return null;
  try {
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
