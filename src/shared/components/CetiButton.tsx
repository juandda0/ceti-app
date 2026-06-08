// components/common/CetiButton.tsx — Botón Liquid Glass Unificado (Android & iOS)
import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
  Pressable,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import { BorderRadius, Spacing, Shadows } from '@shared/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'gold' | 'glass' | 'solid';
type ButtonSize = 'large' | 'medium' | 'small';

interface CetiButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
}

export default function CetiButton({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  isLoading = false,
  disabled = false,
  style,
  backgroundColor,
}: CetiButtonProps) {
  const scale = useSharedValue(1);
  const colors = useThemeColors();
  const handlePressIn = () => {
    if (disabled || isLoading) return;
    scale.value = withTiming(0.97, { duration: 85, easing: Easing.out(Easing.quad) });
  };

  const handlePressOut = () => {
    if (disabled || isLoading) return;
    scale.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) });
  };

  const handlePress = () => {
    if (disabled || isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isGlass = variant === 'glass';

  const getVariantStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {};
    if (backgroundColor) {
      baseStyle.backgroundColor = backgroundColor;
    } else {
      switch (variant) {
        case 'primary':
          baseStyle.backgroundColor = colors.brand.primary;
          break;
        case 'gold':
          baseStyle.backgroundColor = colors.gold.primary;
          break;
        case 'solid':
          baseStyle.backgroundColor = colors.background.primary;
          break;
        case 'secondary':
          baseStyle.backgroundColor = colors.materials.highlight;
          break;
        case 'ghost':
          baseStyle.backgroundColor = colors.materials.highlight;
          baseStyle.borderWidth = 1;
          baseStyle.borderColor = colors.materials.border;
          break;
        case 'destructive':
          baseStyle.backgroundColor = colors.system.red;
          break;
        case 'glass':
          baseStyle.backgroundColor = colors.materials.base;
          break;
      }
    }
    if (variant !== 'ghost' && variant !== 'glass') {
      const shadow =
        variant === 'gold' ? Shadows.gold : variant === 'primary' ? Shadows.brand : Shadows.medium;
      Object.assign(baseStyle, shadow);
    }
    return baseStyle;
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'solid':
        return { color: colors.text.primary, fontWeight: '800' };
      case 'glass':
        return { color: colors.text.primary, fontWeight: '800' };
      case 'primary':
        return { color: colors.text.onBrand, fontWeight: '800' };
      case 'destructive':
        return { color: colors.text.inverse, fontWeight: '800' };
      case 'gold':
        return { color: colors.text.onGold, fontWeight: '800' };
      case 'secondary':
        return { color: colors.text.primary, fontWeight: '700' };
      case 'ghost':
        return { color: colors.text.primary, fontWeight: '700' };
      default:
        return { color: colors.text.onBrand, fontWeight: '700' };
    }
  };

  const getSizeStyle = (): ViewStyle => {
    const height = size === 'large' ? 56 : size === 'medium' ? 48 : 36;
    return { height, paddingHorizontal: size === 'small' ? Spacing.base : Spacing.xl };
  };

  const flatStyle = StyleSheet.flatten(style) || {};
  const {
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    marginHorizontal,
    marginVertical,
    margin,
    width,
    flex,
    alignSelf,
    position,
    top,
    bottom,
    left,
    right,
  } = flatStyle;

  const containerStyle = {
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    marginHorizontal,
    marginVertical,
    margin,
    width,
    flex,
    alignSelf,
    position,
    top,
    bottom,
    left,
    right,
  };

  const buttonOverrideStyle = flatStyle.backgroundColor
    ? { backgroundColor: flatStyle.backgroundColor }
    : {};

  const buttonContent = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || isLoading }}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || isLoading}
      style={[
        styles.button,
        getVariantStyle(),
        getSizeStyle(),
        buttonOverrideStyle,
        (disabled || isLoading) && styles.disabled,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={getTextStyle().color} />
      ) : (
        <Text style={[styles.label, Typography.buttonLarge, getTextStyle()]}>{label}</Text>
      )}
    </Pressable>
  );

  return (
    <Animated.View style={[styles.container, animatedStyle, containerStyle]}>
      {isGlass ? (
        <View
          style={[
            styles.glassWrapper,
            { borderColor: colors.materials.border, backgroundColor: colors.materials.base },
          ]}
        >
          {buttonContent}
        </View>
      ) : (
        buttonContent
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch' },
  button: {
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassWrapper: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  label: { textAlign: 'center' },
  disabled: { opacity: 0.4 },
});
