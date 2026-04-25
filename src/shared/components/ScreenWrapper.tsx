// components/common/ScreenWrapper.tsx — Wrapper para transiciones suaves entre pantallas
import React from 'react';
import { ViewStyle, StyleSheet, StyleProp } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface ScreenWrapperProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}

export default function ScreenWrapper({ children, style, delay = 0 }: ScreenWrapperProps) {
  return (
    <Animated.View 
      entering={FadeIn.duration(400).delay(delay)} 
      exiting={FadeOut.duration(300)}
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
