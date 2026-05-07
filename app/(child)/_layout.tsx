// app/(child)/_layout.tsx — Tab bar integrado, sticky con línea superior
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@shared/store/useThemeStore';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { buildMainTabScreenOptions } from '@shared/navigation/mainTabBarOptions';

const TAB_ICON_SIZE = 24;
const CHILD_TAB_HEIGHT = 90;

export default function ChildTabLayout() {
  const mode = useThemeStore((s) => s.mode);
  const isLight = mode === 'light';
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={buildMainTabScreenOptions({
        colors,
        isLight,
        tabBarHeight: CHILD_TAB_HEIGHT,
      })}
    >
      <Tabs.Screen
        name="world"
        options={{
          title: 'Mundo',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Aprender',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'book' : 'book-outline'} size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          href: null,
          title: 'Ahorros',
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Metas',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'flag' : 'flag-outline'} size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
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
