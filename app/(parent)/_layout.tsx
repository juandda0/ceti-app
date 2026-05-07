// app/(parent)/_layout.tsx — Tab bar integrado, sticky con línea superior
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useThemeStore } from '@shared/store/useThemeStore';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { buildMainTabScreenOptions } from '@shared/navigation/mainTabBarOptions';

const TAB_ICON_SIZE = 26;
const PARENT_TAB_HEIGHT = 62;

export default function ParentLayout() {
  const mode = useThemeStore((s) => s.mode);
  const isLight = mode === 'light';
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={buildMainTabScreenOptions({
        colors,
        isLight,
        tabBarHeight: PARENT_TAB_HEIGHT,
      })}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Resumen',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Análisis',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'bar-chart' : 'bar-chart-outline'}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tareas',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'checkbox' : 'checkbox-outline'}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="assign-reward"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="savings-dashboard"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="add-child"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
