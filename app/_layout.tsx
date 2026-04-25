// app/_layout.tsx — Root Layout de Ceti con animaciones suaves y nuevas fuentes Geometric
import 'react-native-url-polyfill/auto';
import { decode, encode } from 'base-64';
import { Buffer } from 'buffer';
import { Blob, FileReader } from 'blob-polyfill';

// Polyfills globales para Three.js en React Native
if (!global.btoa) { global.btoa = encode; }
if (!global.atob) { global.atob = decode; }
if (!global.Buffer) { global.Buffer = Buffer; }
if (!global.Blob) { global.Blob = Blob; }
if (!global.FileReader) { global.FileReader = FileReader; }

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { 
  useFonts, 
  Outfit_300Light,
  Outfit_400Regular, 
  Outfit_500Medium,
  Outfit_600SemiBold, 
  Outfit_700Bold 
} from '@expo-google-fonts/outfit';
import 'react-native-reanimated';
import { Colors } from '@shared/constants/colors';

import { useThemeStore } from '@shared/store/useThemeStore';
import { LightColors, DarkColors } from '@shared/constants/colors';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const mode = useThemeStore(s => s.mode);
  const colors = mode === 'light' ? LightColors : DarkColors;

  const [fontsLoaded] = useFonts({
    'Outfit-Light': Outfit_300Light,
    'Outfit-Regular': Outfit_400Regular,
    'Outfit-Medium': Outfit_500Medium,
    'Outfit-SemiBold': Outfit_600SemiBold,
    'Outfit-Bold': Outfit_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack 
        screenOptions={{ 
          headerShown: false,
          animation: 'fade_from_bottom',
          contentStyle: { backgroundColor: colors.background.base }
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
    </GestureHandlerRootView>
  );
}
