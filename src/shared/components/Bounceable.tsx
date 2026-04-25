// components/common/Bounceable.tsx
import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  interpolate
} from 'react-native-reanimated';

interface BounceableProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  activeScale?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Bounceable({ 
  children, 
  style, 
  activeScale = 0.92,
  ...props 
}: BounceableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = (e: any) => {
    scale.value = withSpring(activeScale, { damping: 10, stiffness: 200 });
    props.onPressIn?.(e);
  };

  const onPressOut = (e: any) => {
    scale.value = withSpring(1, { damping: 10, stiffness: 200 });
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
