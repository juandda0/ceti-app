// app/_layout.tsx — Root Layout de Ceti (tipografía: sistema del dispositivo)
import 'react-native-url-polyfill/auto';
import { decode, encode } from 'base-64';
import { Buffer } from 'buffer';
import { Blob, FileReader } from 'blob-polyfill';

import { useEffect, useState } from 'react';
import { LogBox, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { LightColors, DarkColors } from '@shared/constants/colors';

import { useThemeStore } from '@shared/store/useThemeStore';
import StreakCelebrationModal from '@shared/components/StreakCelebrationModal';
import CetiOverlayHost from '@shared/components/CetiOverlayHost';
import { AppErrorBoundary } from '@shared/components/AppErrorBoundary';
import { rehydrateAllPersistedStores } from '@shared/session/hydrateStores';
import { initFirebaseAuthSession } from '@shared/lib/firebase/authSession';
import { seedLocalDataToRemoteIfNeeded } from '@shared/session/syncRemote';
import {
  startFamilyChildrenRemoteSync,
  stopFamilyChildrenRemoteSync,
} from '@shared/session/firestoreSync';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useParentStore } from '@features/family/store/useParentStore';

import './i18n';

// Polyfills globales para Three.js en React Native
if (!global.btoa) {
  global.btoa = encode;
}
if (!global.atob) {
  global.atob = decode;
}
if (!global.Buffer) {
  global.Buffer = Buffer;
}
if (!global.Blob) {
  global.Blob = Blob;
}
if (!global.FileReader) {
  global.FileReader = FileReader;
}

// Splash usa keep-awake; falla en web, con pantalla apagada durante la carga, etc.
LogBox.ignoreLogs(['Unable to activate keep awake']);

async function preventSplashAutoHideSafe() {
  try {
    await SplashScreen.preventAutoHideAsync();
  } catch {
    /* noop */
  }
}
void preventSplashAutoHideSafe();

if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('unhandledrejection', (event: Event) => {
    const e = event as PromiseRejectionEvent;
    const reason = e.reason;
    const msg =
      typeof reason === 'object' && reason !== null && 'message' in reason
        ? String((reason as { message?: string }).message)
        : String(reason ?? '');
    if (msg.includes('Unable to activate keep awake') && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
  });
}

export default function RootLayout() {
  const mode = useThemeStore((s) => s.mode);
  const colors = mode === 'light' ? LightColors : DarkColors;
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await rehydrateAllPersistedStores();
      } catch {
        /* noop */
      }
      try {
        await initFirebaseAuthSession();
      } catch {
        useAuthStore.getState().markAuthReady();
      }
      try {
        await seedLocalDataToRemoteIfNeeded();
      } catch {
        /* noop */
      }
      if (!cancelled) {
        const { isAuthenticated, userRole } = useAuthStore.getState();
        const familyId = useParentStore.getState().familyId;
        if (isAuthenticated && userRole === 'parent' && familyId) {
          startFamilyChildrenRemoteSync(familyId);
        }
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
      stopFamilyChildrenRemoteSync();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void (async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {
        /* noop */
      }
    })();
  }, [hydrated]);

  useEffect(() => {
    if (Platform.OS === 'web' || __DEV__) return;
    type CrashMod = () => { recordError: (e: Error) => void; log: (m: string) => void };
    let getCrashlytics: CrashMod;
    try {
      getCrashlytics = require('@react-native-firebase/crashlytics').default as CrashMod;
    } catch {
      return;
    }
    const prev = console.error;
    console.error = (...args: unknown[]) => {
      prev(...args);
      try {
        const first = args[0];
        if (first instanceof Error) getCrashlytics().recordError(first);
        else getCrashlytics().log(args.map(String).join(' '));
      } catch {
        /* noop */
      }
    };
    return () => {
      console.error = prev;
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppErrorBoundary>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade_from_bottom',
              contentStyle: { backgroundColor: colors.background.base },
            }}
          >
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(child)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(parent)" options={{ animation: 'fade' }} />
            <Stack.Screen
              name="lesson/[id]"
              options={{
                animation: 'slide_from_bottom',
                presentation: 'fullScreenModal',
              }}
            />
          </Stack>
          <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
          <StreakCelebrationModal />
          <CetiOverlayHost />
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
