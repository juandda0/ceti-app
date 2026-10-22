import { Animated, Easing, StyleSheet } from 'react-native';
import type { ThemeColors } from '@shared/constants/colors';
import { contextMs } from '@shared/constants/motion';

export type MainTabBarNavOptionsArgs = {
  colors: ThemeColors;
  isLight: boolean;
  tabBarHeight: number;
};

/**
 * Cambio de contexto entre pestañas: la estructura (barra de abajo) se queda
 * quieta. Los bloques de cada pantalla se desarman y se arman solos
 * (ContextScrollView); aquí solo se decide qué escena se ve: la que sale sigue
 * visible mientras se desarma (contextMs.out) y en ese instante se corta a la
 * que entra, que aún está vacía y empieza a armarse. Sin fundido de escena ni
 * desplazamiento (las pestañas son pares, no hay profundidad).
 */
function forContextChange({ current }: { current: { progress: Animated.Value } }) {
  return {
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, -0.501, -0.5, 0.5, 0.501, 1],
        outputRange: [0, 0, 1, 1, 0, 0],
      }),
    },
  };
}

/**
 * Variante simple (pestañas con pantallas complejas, p. ej. Aprender): la
 * escena entera se apaga al salir y se enciende al entrar ("fade through",
 * en las mismas mitades que el desarme/corte), sin armado por bloques.
 */
function forSimpleFade({ current }: { current: { progress: Animated.Value } }) {
  return {
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, -0.5, 0, 0.5, 1],
        outputRange: [0, 0, 1, 0, 0],
      }),
    },
  };
}

/** Opciones de una pestaña que usa la variante simple. */
export const simpleTabTransition = { sceneStyleInterpolator: forSimpleFade };

const tabContextTransition = {
  animation: 'fade' as const,
  sceneStyleInterpolator: forContextChange,
  transitionSpec: {
    animation: 'timing' as const,
    // Lineal: la mitad del recorrido (el corte) cae justo al terminar el desarme.
    config: { duration: contextMs.out * 2, easing: Easing.linear },
  },
};

/**
 * Opciones compartidas entre tabs hijo y padre (deduplica estilos).
 */
export function buildMainTabScreenOptions({
  colors,
  isLight,
  tabBarHeight,
}: MainTabBarNavOptionsArgs) {
  return {
    headerShown: false,
    tabBarShowLabel: true,
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
    ...tabContextTransition,
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
