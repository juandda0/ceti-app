import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import { getFirebaseClients } from '@shared/lib/firebase/app';

type Extra = {
  googleWebClientId?: string;
  googleIosClientId?: string;
  featureAppleSignIn?: string | boolean;
};

function readExtra(): Extra {
  const e = (Constants.expoConfig?.extra ?? {}) as Extra;
  return e;
}

let googleConfigured = false;

export function configureGoogleSignIn(): void {
  if (Platform.OS === 'web') return;
  if (googleConfigured) return;
  const { googleWebClientId, googleIosClientId } = readExtra();
  if (!googleWebClientId) return;
  const ios =
    typeof googleIosClientId === 'string' && googleIosClientId.trim().length > 0
      ? googleIosClientId
      : undefined;
  GoogleSignin.configure(
    ios ? { webClientId: googleWebClientId, iosClientId: ios } : { webClientId: googleWebClientId }
  );
  googleConfigured = true;
}

/**
 * Web: usa el flujo OAuth del JS SDK (popup; fallback a redirect si el navegador
 * lo bloquea). No requiere @react-native-google-signin ni Play Services.
 */
async function signInWithGoogleWeb(): Promise<void> {
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Configura Firebase (EXPO_PUBLIC_FIREBASE_*)');

  const provider = new GoogleAuthProvider();
  // Fuerza el selector de cuentas en cada inicio (paridad con el flujo nativo).
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    await signInWithPopup(clients.auth, provider);
  } catch (e) {
    const code =
      e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : '';

    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new Error('Inicio de sesión con Google cancelado');
    }
    // Popup bloqueado por el navegador: degradar a redirect (recarga la página).
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(clients.auth, provider);
      return;
    }
    if (code === 'auth/network-request-failed') {
      throw new Error('No se pudo verificar la sesión con Firebase (red). Inténtalo de nuevo.');
    }
    if (code === 'auth/unauthorized-domain') {
      throw new Error(
        'Dominio no autorizado. En Firebase → Authentication → Settings → Authorized domains, agrega el dominio donde corre la web.'
      );
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
}

export async function signInWithGoogle(): Promise<void> {
  if (Platform.OS === 'web') {
    return signInWithGoogleWeb();
  }
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Configura Firebase (EXPO_PUBLIC_FIREBASE_*)');
  configureGoogleSignIn();
  if (!readExtra().googleWebClientId) {
    throw new Error('Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID en .env');
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') {
      throw new Error('Inicio de sesión con Google cancelado');
    }

    let idToken = response.data.idToken;
    if (!idToken) {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens.idToken;
    }
    if (!idToken) {
      throw new Error(
        'Google no devolvió idToken. Comprueba en Firebase → Auth → Google el **Web client ID** (no uses el de Android/iOS) en EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.'
      );
    }

    const credential = GoogleAuthProvider.credential(idToken);
    try {
      await signInWithCredential(clients.auth, credential);
    } catch (authErr) {
      const code =
        authErr && typeof authErr === 'object' && 'code' in authErr
          ? String((authErr as { code?: string }).code)
          : '';
      if (code === 'auth/invalid-credential') {
        throw new Error(
          'Firebase rechazó la credencial. En Firebase Console activa el proveedor **Google** en Authentication y usa el **Web client ID** del mismo proyecto en EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.'
        );
      }
      if (code === 'auth/network-request-failed') {
        throw new Error('No se pudo verificar la sesión con Firebase (red). Inténtalo de nuevo.');
      }
      throw authErr instanceof Error ? authErr : new Error(String(authErr));
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'Inicio de sesión con Google cancelado') throw e;

    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error('Inicio de sesión con Google cancelado');
      }
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error(
          'Google Play Services no está disponible o debe actualizarse en este dispositivo.'
        );
      }
      if (e.code === statusCodes.IN_PROGRESS) {
        throw new Error(
          'Ya hay un inicio de sesión con Google en curso. Espera un momento e inténtalo de nuevo.'
        );
      }
    }

    const msg = e instanceof Error ? e.message : String(e);
    if (
      /\b10\b|DEVELOPER_ERROR|developer[_ ]error/i.test(msg) ||
      (isErrorWithCode(e) && String(e.code) === '10')
    ) {
      if (__DEV__) {
        console.warn(
          '[Google Sign-In DEVELOPER_ERROR] Checklist:\n' +
            '• Firebase → Project settings → app Android: SHA-1 del keystore (debug: android/gradlew signingReport), nuevo google-services.json, rebuild.\n' +
            '• EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = OAuth tipo Web del mismo proyecto.\n' +
            '• Package name = app en Firebase. Auth → Google activado.\n' +
            '• npx @react-native-google-signin/config-doctor'
        );
      }
      throw new Error(
        [
          'Configuración incorrecta (DEVELOPER_ERROR).',
          '',
          '1) Firebase: añade el SHA-1 del keystore de este build, descarga otra vez google-services.json y vuelve a compilar la app.',
          '2) En .env usa el OAuth client tipo Web, no el de Android.',
          '3) En consola: npx @react-native-google-signin/config-doctor',
          '',
          'https://react-native-google-signin.github.io/docs/troubleshooting#developer_error',
        ].join('\n')
      );
    }

    if (/NETWORK_ERROR|network/i.test(msg)) {
      throw new Error('Sin conexión o error de red al contactar con Google.');
    }

    throw e instanceof Error ? e : new Error(String(e));
  }
}

export function isAppleSignInAvailable(): boolean {
  // Web: Firebase soporta Apple vía OAuthProvider (popup), igual que Google.
  // Mostramos el botón siempre que Firebase esté configurado; si el proveedor
  // no está habilitado en la consola, el click devuelve un error claro.
  if (Platform.OS === 'web') return !!getFirebaseClients();
  // Nativo iOS: Sign in with Apple nativo, detrás del feature flag.
  const extra = readExtra();
  if (extra.featureAppleSignIn !== true && extra.featureAppleSignIn !== '1') return false;
  return Platform.OS === 'ios';
}

/** Web: flujo OAuth de Apple con el JS SDK (popup; fallback a redirect). */
async function signInWithAppleWeb(): Promise<void> {
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Configura Firebase (EXPO_PUBLIC_FIREBASE_*)');

  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');

  try {
    await signInWithPopup(clients.auth, provider);
  } catch (e) {
    const code =
      e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : '';

    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new Error('Inicio de sesión con Apple cancelado');
    }
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(clients.auth, provider);
      return;
    }
    if (code === 'auth/network-request-failed') {
      throw new Error('No se pudo verificar la sesión con Firebase (red). Inténtalo de nuevo.');
    }
    if (code === 'auth/unauthorized-domain') {
      throw new Error(
        'Dominio no autorizado. En Firebase → Authentication → Settings → Authorized domains, agrega el dominio donde corre la web.'
      );
    }
    if (code === 'auth/operation-not-allowed') {
      throw new Error(
        'Apple no está habilitado. Actívalo en Firebase → Authentication → Sign-in method → Apple.'
      );
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
}

export async function signInWithApple(): Promise<void> {
  if (Platform.OS === 'web') {
    return signInWithAppleWeb();
  }
  if (!isAppleSignInAvailable()) {
    throw new Error('Sign in with Apple no está activo');
  }
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Configura Firebase');
  const apple = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!apple.identityToken) throw new Error('Apple no devolvió identityToken');
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({ idToken: apple.identityToken });
  await signInWithCredential(clients.auth, credential);
}

/** Cierra sesión en proveedores nativos y limpia caché de Google para forzar el selector de cuentas en el próximo login. */
export async function signOutOAuthProviders(): Promise<void> {
  if (Platform.OS === 'web') return;

  // Necesario para que signOut/revoke funcionen igual si el usuario no abrió login en esta sesión.
  configureGoogleSignIn();
  if (!readExtra().googleWebClientId) return;

  try {
    if (GoogleSignin.hasPreviousSignIn()) {
      try {
        const { accessToken } = await GoogleSignin.getTokens();
        if (Platform.OS === 'android' && accessToken) {
          await GoogleSignin.clearCachedAccessToken(accessToken);
        }
      } catch {
        /* sin tokens en caché */
      }
    }
  } catch {
    /* noop */
  }

  try {
    await GoogleSignin.signOut();
  } catch {
    /* noop */
  }

  try {
    await GoogleSignin.revokeAccess();
  } catch {
    /* noop — puede fallar si no había conexión OAuth activa */
  }
}
