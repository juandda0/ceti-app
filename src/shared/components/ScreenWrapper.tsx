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

// Reanimated layout animations (entering/exiting) are unreliable on web: the
// exiting screen can stay mounted as an invisible overlay that swallows taps,
// or leave the view offset — breaking buttons/inputs. Disable them on web.
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
