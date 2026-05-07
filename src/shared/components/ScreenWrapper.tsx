// components/common/ScreenWrapper.tsx — Wrapper para transiciones suaves entre pantallas
import React from 'react';
import { ViewStyle, StyleSheet, StyleProp } from 'react-native';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';

interface ScreenWrapperProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}

export default function ScreenWrapper({ children, style, delay = 0 }: ScreenWrapperProps) {
  return (
    <Animated.View
      entering={motion.screenEnter(delay)}
      exiting={motion.screenExit}
      style={[styles.container, style]}
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
