// components/common/ScreenWrapper.tsx — Wrapper para transiciones suaves entre pantallas
import React from 'react';
import { ViewStyle, StyleSheet, StyleProp, Platform } from 'react-native';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import { useThemeColors } from '@shared/hooks/useThemeColors';

interface ScreenWrapperProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}

// Las layout-animations de reanimated (entering/exiting) son inestables en web:
// el entering puede dejar la pantalla montada en opacity 0 (invisible) y el
// exiting deja overlays fantasma que tragan taps. En web la transición la da el
// navegador (Stack animation: 'fade' en los _layout); reanimated solo en nativo.
const isWeb = Platform.OS === 'web';

export default function ScreenWrapper({ children, style, delay = 0 }: ScreenWrapperProps) {
  const colors = useThemeColors();
  return (
    <Animated.View
      entering={isWeb ? undefined : motion.screenEnter(delay)}
      exiting={isWeb ? undefined : motion.screenExit}
      // Default themed background so screens that don't set one don't fall back to
      // the navigator's default (white on web). Screens can still override.
      style={[styles.container, { backgroundColor: colors.background.base }, style]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
