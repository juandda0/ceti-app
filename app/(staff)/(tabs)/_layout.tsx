import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@shared/store/useThemeStore';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { buildMainTabScreenOptions } from '@shared/navigation/mainTabBarOptions';

const TAB_ICON_SIZE = 24;
const TAB_HEIGHT = 90;

/** Pestañas del profesor: misma barra y cambio de contexto que las del estudiante. */
export default function StaffTabsLayout() {
  const { t } = useTranslation();
  const isLight = useThemeStore((s) => s.mode) === 'light';
  const colors = useThemeColors();

  return (
    <Tabs screenOptions={buildMainTabScreenOptions({ colors, isLight, tabBarHeight: TAB_HEIGHT })}>
      <Tabs.Screen
        name="clases"
        options={{
          title: t('profe.tabClases'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="colegio"
        options={{
          title: t('profe.tabColegio'),
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
        name="perfil"
        options={{
          title: t('profe.tabPerfil'),
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
