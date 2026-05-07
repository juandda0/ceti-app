import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import { getFirebaseClients, isFirebaseConfigured } from '@shared/lib/firebase/app';

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

export async function signInWithGoogle(): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Inicia sesión desde la app para Android o iOS.');
  }
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Configura Firebase (EXPO_PUBLIC_FIREBASE_*)');
  configureGoogleSignIn();
  if (!readExtra().googleWebClientId) {
    throw new Error('Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID en .env');
  }
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  const idToken = response.data?.idToken;
  if (!idToken) throw new Error('Google no devolvió idToken');
  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(clients.auth, credential);
}

export function isAppleSignInAvailable(): boolean {
  const extra = readExtra();
  if (extra.featureAppleSignIn !== true && extra.featureAppleSignIn !== '1') return false;
  return Platform.OS === 'ios';
}

export async function signInWithApple(): Promise<void> {
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

export function assertFirebaseAuth(): void {
  if (!isFirebaseConfigured()) throw new Error('Firebase no configurado');
}

/** Cierra sesión en proveedores nativos (p. ej. Google) además de Firebase. */
export async function signOutOAuthProviders(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    /* noop */
  }
}
