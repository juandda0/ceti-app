/**
 * firebase/auth tipa solo el entry “web”; en React Native Metro resuelve el bundle `dist/rn`
 * donde sí existe getReactNativePersistence. Ampliación mínima para typecheck.
 * @see https://firebase.google.com/docs/auth/web/start
 */
import 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }): import('firebase/auth').Persistence;
}
