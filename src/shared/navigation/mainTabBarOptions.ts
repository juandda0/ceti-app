import { StyleSheet } from 'react-native';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { ThemeColors } from '@shared/constants/colors';

export type MainTabBarNavOptionsArgs = {
  colors: ThemeColors;
  isLight: boolean;
  tabBarHeight: number;
};

/**
 * Opciones compartidas entre tabs hijo y padre (deduplica estilos).
 */
export function buildMainTabScreenOptions({
  colors,
  isLight,
  tabBarHeight,
}: MainTabBarNavOptionsArgs): BottomTabNavigationOptions {
  return {
    headerShown: false,
    tabBarShowLabel: false,
    tabBarActiveTintColor: isLight ? colors.brand.primary : colors.text.secondary,
    tabBarInactiveTintColor: isLight ? colors.text.tertiary : colors.text.quaternary,
    tabBarStyle: [
      styles.tabBar,
      {
        height: tabBarHeight,
        backgroundColor: colors.background.base,
        borderTopColor: colors.materials.border,
      },
    ],
    tabBarItemStyle: styles.tabBarItem,
  };
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
});
