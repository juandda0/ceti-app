import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { startSession, type SessionUser } from '@shared/lib/auth/session';
import { ApiError } from '@shared/lib/api/client';

type Extra = {
  googleWebClientId?: string;
  googleIosClientId?: string;
};

function readExtra(): Extra {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
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

// Google Identity Services (web). Tipado mínimo de lo que usamos.
type GisCodeClient = { requestCode: () => void };
type GisWindow = {
  google?: {
    accounts: {
      oauth2: {
        initCodeClient: (config: {
          client_id: string;
          scope: string;
          ux_mode: 'popup';
          callback: (res: { code?: string; error?: string }) => void;
          error_callback?: (err: { type?: string }) => void;
        }) => GisCodeClient;
      };
    };
  };
};

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let gisLoading: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if ((globalThis as GisWindow).google?.accounts) return Promise.resolve();
  gisLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoading = null;
      reject(new Error('No se pudo cargar el inicio de sesión de Google.'));
    };
    document.head.appendChild(script);
  });
  return gisLoading;
}

/**
 * Web: popup OAuth (code flow). El backend canjea el code por el ID token con
 * el client secret, que nunca llega al navegador.
 */
async function googleWebCode(): Promise<string> {
  const { googleWebClientId } = readExtra();
  if (!googleWebClientId) throw new Error('Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID en .env');
  await loadGis();
  const gis = (globalThis as GisWindow).google!;
  return new Promise<string>((resolve, reject) => {
    gis.accounts.oauth2
      .initCodeClient({
        client_id: googleWebClientId,
        scope: 'openid email profile',
        ux_mode: 'popup',
        callback: (res) => {
          if (res.code) resolve(res.code);
          else reject(new Error('Inicio de sesión con Google cancelado'));
        },
        error_callback: (err) =>
          reject(
            new Error(
              err.type === 'popup_failed_to_open'
                ? 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes e inténtalo de nuevo.'
                : 'Inicio de sesión con Google cancelado'
            )
          ),
      })
      .requestCode();
  });
}

async function googleNativeIdToken(): Promise<string> {
  configureGoogleSignIn();
  if (!readExtra().googleWebClientId) {
    throw new Error('Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID en .env');
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') throw new Error('Inicio de sesión con Google cancelado');
    const idToken = response.data.idToken ?? (await GoogleSignin.getTokens()).idToken;
    if (!idToken) {
      throw new Error(
        'Google no devolvió idToken. Usa el **Web client ID** (no el de Android/iOS) en EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.'
      );
    }
    return idToken;
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
    if (/\b10\b|DEVELOPER_ERROR|developer[_ ]error/i.test(msg)) {
      throw new Error(
        [
          'Configuración incorrecta (DEVELOPER_ERROR).',
          '',
          '1) Google Cloud: registra el SHA-1 del keystore de este build en el OAuth client Android.',
          '2) En .env usa el OAuth client tipo Web, no el de Android.',
          '3) En consola: npx @react-native-google-signin/config-doctor',
        ].join('\n')
      );
    }
    if (/NETWORK_ERROR|network/i.test(msg)) {
      throw new Error('Sin conexión o error de red al contactar con Google.');
    }
    throw e instanceof Error ? e : new Error(msg);
  }
}

export async function signInWithGoogle(): Promise<SessionUser> {
  const body =
    Platform.OS === 'web' ? { code: await googleWebCode() } : { idToken: await googleNativeIdToken() };
  try {
    return await startSession('/api/auth/google', body);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      throw new Error('El servidor rechazó la credencial de Google. Inténtalo de nuevo.');
    }
    throw e;
  }
}

/** Cierra sesión en Google nativo para forzar el selector de cuentas en el próximo login. */
export async function signOutOAuthProviders(): Promise<void> {
  if (Platform.OS === 'web') return;
  configureGoogleSignIn();
  if (!readExtra().googleWebClientId) return;
  // Best-effort: sin sesión Google previa estas llamadas fallan y no importa.
  await GoogleSignin.signOut().catch(() => undefined);
  await GoogleSignin.revokeAccess().catch(() => undefined);
}
