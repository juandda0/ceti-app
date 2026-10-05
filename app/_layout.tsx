import 'react-native-url-polyfill/auto';
import { decode, encode } from 'base-64';
import { Buffer } from 'buffer';
import { Blob, FileReader } from 'blob-polyfill';

import { useEffect, useState } from 'react';
import { LogBox } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import 'react-native-reanimated';
import { LightColors, DarkColors } from '@shared/constants/colors';

import { useThemeStore } from '@shared/store/useThemeStore';
import CetiOverlayHost from '@shared/components/CetiOverlayHost';
import { AppErrorBoundary } from '@shared/components/AppErrorBoundary';
import { rehydrateAllPersistedStores } from '@shared/session/hydrateStores';
import { initAuthSession } from '@shared/lib/auth/authSession';
import { startUserRemoteSync, stopUserRemoteSync } from '@shared/session/userRemoteSync';
import { useAuthStore } from '@features/auth/store/useAuthStore';

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

  // Preload icon fonts. On web @expo/vector-icons relies on @font-face injection;
  // loading explicitly avoids tofu boxes ([]) when auto-injection races/fails.
  useEffect(() => {
    Font.loadAsync(Ionicons.font).catch(() => {});
  }, []);

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
        await initAuthSession();
      } catch {
        useAuthStore.getState().markAuthReady();
      }

      function syncRemoteIfAuthenticated() {
        const { isAuthenticated, uid } = useAuthStore.getState();
        if (isAuthenticated && uid?.trim()) {
          startUserRemoteSync(uid.trim());
        } else {
          stopUserRemoteSync();
        }
      }

      if (!cancelled) syncRemoteIfAuthenticated();
      cleanups.push(useAuthStore.subscribe(syncRemoteIfAuthenticated));

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppErrorBoundary>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              animationDuration: 200,
              contentStyle: { backgroundColor: colors.background.base },
            }}
          >
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(staff)" options={{ animation: 'fade' }} />
          </Stack>
          <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
          <CetiOverlayHost />
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
