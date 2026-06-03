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
import { isNativeFirebaseAppAvailable } from '@shared/lib/analytics/crashlytics';
import { startUserRemoteSync, stopUserRemoteSync } from '@shared/session/userRemoteSync';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { getFirebaseClients, isFirebaseConfigured } from '@shared/lib/firebase/app';

import '@shared/i18n';

if (!global.btoa) global.btoa = encode;
if (!global.atob) global.atob = decode;
if (!global.Buffer) global.Buffer = Buffer;
if (!global.Blob) global.Blob = Blob;
if (!global.FileReader) global.FileReader = FileReader;

LogBox.ignoreLogs(['Unable to activate keep awake']);
if (__DEV__) {
  LogBox.ignoreLogs([
    'Looks like you have configured linking in multiple places',
    /configured linking in multiple places/i,
  ]);
}

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
    const cleanups: (() => void)[] = [];

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

      function syncRemoteIfAuthenticated() {
        const { isAuthenticated, firebaseUid } = useAuthStore.getState();
        if (isAuthenticated && firebaseUid?.trim()) {
          startUserRemoteSync(firebaseUid.trim());
        } else {
          stopUserRemoteSync();
        }
      }

      if (!cancelled) syncRemoteIfAuthenticated();
      cleanups.push(useAuthStore.subscribe(syncRemoteIfAuthenticated));

      if (!cancelled && isFirebaseConfigured()) {
        const clients = getFirebaseClients();
        if (clients) {
          const seedUnsub = clients.auth.onIdTokenChanged(async (user) => {
            if (!user) return;
            try {
              await seedLocalDataToRemoteIfNeeded();
            } catch {
              /* noop */
            }
          });
          cleanups.push(seedUnsub);
        }
      }

      if (!cancelled) setHydrated(true);
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      stopUserRemoteSync();
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
    if (!isNativeFirebaseAppAvailable()) return;
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
            <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(staff)" options={{ animation: 'fade' }} />
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
