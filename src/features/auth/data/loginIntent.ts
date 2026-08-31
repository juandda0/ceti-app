/**
 * Login intent (D-ADMIN): whether the user declared themselves 'estudiante' or
 * 'profesor' in the role bottom sheet before signing in. The server provisions
 * that professor into a new isolated colegio; 'estudiante' goes to the join gate.
 *
 * Persisted (sync) so it survives a full page reload — otherwise a pending
 * professor who refreshes, or the web redirect-OAuth fallback (which reloads the
 * page), would lose the intent and be misrouted into the student flow. Web:
 * sessionStorage (per-tab, cleared on tab close). Native: MMKV. Cleared on logout.
 */
import { Platform } from 'react-native';
import { getAppMmkv } from '@shared/lib/storage/mmkv';

export type LoginIntent = 'estudiante' | 'profesor';

const KEY = 'ceti_login_intent';

function isIntent(v: unknown): v is LoginIntent {
  return v === 'estudiante' || v === 'profesor';
}

function readPersisted(): LoginIntent | null {
  try {
    if (Platform.OS === 'web') {
      const v = globalThis.sessionStorage?.getItem(KEY);
      return isIntent(v) ? v : null;
    }
    const v = getAppMmkv()?.getString(KEY);
    return isIntent(v) ? v : null;
  } catch {
    return null;
  }
}

function writePersisted(value: LoginIntent | null): void {
  try {
    if (Platform.OS === 'web') {
      const store = globalThis.sessionStorage;
      if (!store) return;
      if (value) store.setItem(KEY, value);
      else store.removeItem(KEY);
      return;
    }
    const mmkv = getAppMmkv();
    if (!mmkv) return;
    if (value) mmkv.set(KEY, value);
    else mmkv.delete(KEY);
  } catch {
    /* noop */
  }
}

// In-memory cache keeps get() fast; the persisted copy is the reload survivor.
let intent: LoginIntent | null = null;

export const loginIntent = {
  set: (value: LoginIntent): void => {
    intent = value;
    writePersisted(value);
  },
  /** Peek (non-destructive): the bootstrap re-runs on every auth change. */
  get: (): LoginIntent | null => intent ?? readPersisted(),
  clear: (): void => {
    intent = null;
    writePersisted(null);
  },
};
