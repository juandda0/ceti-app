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
  Platform
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';
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
  const mode = useThemeStore(s => s.mode);

  const handlePressIn = () => {
    if (disabled || isLoading) return;
    scale.value = withSpring(0.96, { stiffness: 400, damping: 15 });
  };

  const handlePressOut = () => {
    if (disabled || isLoading) return;
    scale.value = withSpring(1, { stiffness: 400, damping: 15 });
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
        case 'primary': baseStyle.backgroundColor = colors.brand.primary; break;
        case 'gold': baseStyle.backgroundColor = colors.gold.primary; break;
        case 'solid': baseStyle.backgroundColor = colors.background.primary; break;
        case 'secondary': baseStyle.backgroundColor = colors.materials.highlight; break;
        case 'ghost':
          baseStyle.backgroundColor = 'transparent';
          baseStyle.borderWidth = 1;
          baseStyle.borderColor = colors.materials.border;
          break;
        case 'destructive': baseStyle.backgroundColor = colors.system.red; break;
        case 'glass': baseStyle.backgroundColor = 'transparent'; break;
      }
    }
    if (variant !== 'ghost' && variant !== 'glass') {
      const shadow = variant === 'gold' ? Shadows.gold : variant === 'primary' ? Shadows.brand : Shadows.medium;
      Object.assign(baseStyle, shadow);
    }
    return baseStyle;
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'solid': return { color: colors.text.primary, fontWeight: '800' };
      case 'glass': return { color: colors.text.primary, fontWeight: '800' };
      case 'primary': return { color: colors.text.onBrand, fontWeight: '800' };
      case 'destructive': return { color: '#FFFFFF', fontWeight: '800' }; 
      case 'gold': return { color: colors.text.onGold, fontWeight: '800' };
      case 'secondary': return { color: colors.text.primary, fontWeight: '700' };
      default: return { color: colors.text.onBrand, fontWeight: '700' };
    }
  };

  const getSizeStyle = (): ViewStyle => {
    const height = size === 'large' ? 56 : size === 'medium' ? 48 : 36;
    return { height, paddingHorizontal: size === 'small' ? Spacing.base : Spacing.xl };
  };

  const flatStyle = StyleSheet.flatten(style) || {};
  const { 
    marginTop, marginBottom, marginLeft, marginRight, 
    marginHorizontal, marginVertical, margin,
    width, flex, alignSelf, position, top, bottom, left, right 
  } = flatStyle;

  const containerStyle = { 
    marginTop, marginBottom, marginLeft, marginRight, 
    marginHorizontal, marginVertical, margin,
    width, flex, alignSelf, position, top, bottom, left, right 
  };

  const buttonOverrideStyle = flatStyle.backgroundColor ? { backgroundColor: flatStyle.backgroundColor } : {};

  const buttonContent = (
    <Pressable
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
        <Text style={[styles.label, Typography.buttonLarge, getTextStyle()]}>
          {label}
        </Text>
      )}
    </Pressable>
  );

  return (
    <Animated.View style={[styles.container, animatedStyle, containerStyle]}>
      {isGlass ? (
        <View style={[styles.glassWrapper, { borderColor: colors.materials.border, backgroundColor: colors.materials.base }]}>
          <BlurView 
            intensity={35} 
            tint={mode === 'light' ? 'light' : 'dark'} 
            {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'none' } : {})}
            style={styles.blur}
          >
            {buttonContent}
            <View style={styles.topShine} pointerEvents="none" />
          </BlurView>
        </View>
      ) : (
        buttonContent
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch' },
  button: { borderRadius: BorderRadius.full, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  glassWrapper: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  blur: { borderRadius: BorderRadius.full },
  label: { textAlign: 'center' },
  disabled: { opacity: 0.4 },
  topShine: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.full,
    backgroundColor: 'transparent',
  },
});
