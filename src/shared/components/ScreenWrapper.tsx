// components/common/ScreenWrapper.tsx — Wrapper para transiciones suaves entre pantallas
import React from 'react';
import { ViewStyle, StyleSheet, StyleProp } from 'react-native';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import { useThemeColors } from '@shared/hooks/useThemeColors';

interface ScreenWrapperProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}

export default function ScreenWrapper({ children, style, delay = 0 }: ScreenWrapperProps) {
  const colors = useThemeColors();
  return (
    <Animated.View
      entering={motion.screenEnter(delay)}
      exiting={motion.screenExit}
      // Default themed background so screens that don't set one don't fall back to
      // the navigator's default (white on web) -> white text on white background.
      // Screens can still override via `style`.
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
