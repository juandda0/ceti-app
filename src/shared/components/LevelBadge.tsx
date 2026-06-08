// components/common/LevelBadge.tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import { BorderRadius } from '@shared/constants/theme';

type BadgeSize = 'sm' | 'md' | 'lg';

interface LevelBadgeProps {
  level: number;
  size?: BadgeSize;
  animateOnChange?: boolean;
}

export default function LevelBadge({
  level,
  size = 'md',
  animateOnChange = true,
}: LevelBadgeProps) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (animateOnChange) {
      scale.value = withSequence(
        withTiming(1.12, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) })
      );
    }
  }, [level, animateOnChange]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getBadgeColor = () => {
    if (level <= 2) return colors.system.teal;
    if (level <= 4) return colors.brand.primary;
    return colors.system.purple;
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'sm':
        return { height: 24, paddingHorizontal: 8 };
      case 'md':
        return { height: 32, paddingHorizontal: 12 };
      case 'lg':
        return { height: 40, paddingHorizontal: 16 };
      default:
        return { height: 32, paddingHorizontal: 12 };
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        getSizeStyle(),
        { backgroundColor: getBadgeColor() },
        animatedStyle,
      ]}
    >
      <Ionicons name="star" size={size === 'sm' ? 12 : 16} color={colors.text.onBrand} />
      <Text
        style={[
          styles.text,
          Typography.caption1,
          { fontWeight: '700', color: colors.text.onBrand, marginLeft: 4 },
        ]}
      >
        Nv. {level}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    ...Typography.caption1,
  },
});
