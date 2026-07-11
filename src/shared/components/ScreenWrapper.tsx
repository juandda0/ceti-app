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

// El fade de ENTRADA es seguro en web (anima la pantalla nueva al montar). El de
// SALIDA no: la pantalla saliente puede quedar montada como overlay invisible que
// traga taps o queda desplazada. Por eso: entrada en ambas plataformas, salida
// solo en nativo.
const isWeb = Platform.OS === 'web';

export default function ScreenWrapper({ children, style, delay = 0 }: ScreenWrapperProps) {
  const colors = useThemeColors();
  return (
    <Animated.View
      entering={motion.screenEnter(delay)}
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
