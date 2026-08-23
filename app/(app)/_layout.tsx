import { useCallback, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { Tabs, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@shared/store/useThemeStore';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { buildMainTabScreenOptions } from '@shared/navigation/mainTabBarOptions';
import { performLogoutAndGo } from '@features/auth/performLogout';

const TAB_ICON_SIZE = 24;
const TAB_HEIGHT = 90;

export default function AppTabLayout() {
  const router = useRouter();
  const backLogoutBusyRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const onHardwareBack = () => {
        if (backLogoutBusyRef.current) return true;
        backLogoutBusyRef.current = true;
        void (async () => {
          try {
            await performLogoutAndGo(router, '/(auth)/welcome');
          } finally {
            backLogoutBusyRef.current = false;
          }
        })();
        return true;
      };

      const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => sub.remove();
    }, [router])
  );

  const mode = useThemeStore((s) => s.mode);
  const isLight = mode === 'light';
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={buildMainTabScreenOptions({
        colors,
        isLight,
        tabBarHeight: TAB_HEIGHT,
      })}
    >
      <Tabs.Screen
        name="saga"
        options={{
          title: 'Aprender',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dinero"
        options={{
          title: 'Mi dinero',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'wallet' : 'wallet-outline'}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen name="savings" options={{ href: null }} />
      <Tabs.Screen name="movimientos" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
