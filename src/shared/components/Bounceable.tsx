// components/common/Bounceable.tsx
import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { pressInTiming, pressOutTiming } from '@shared/constants/motion';

interface BounceableProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  activeScale?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Bounceable({
  children,
  style,
  activeScale = 0.96,
  ...props
}: BounceableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = (e: any) => {
    scale.value = withTiming(activeScale, pressInTiming);
    props.onPressIn?.(e);
  };

  const onPressOut = (e: any) => {
    scale.value = withTiming(1, pressOutTiming);
    props.onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      {...props}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
