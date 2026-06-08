import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import { BorderRadius, Spacing } from '@shared/constants/theme';
import { useThemeColors } from '@shared/hooks/useThemeColors';

type CardVariant = 'hero' | 'regular';

interface CetiCardProps {
  children: React.ReactNode;
  /** `hero` añade más padding; `regular` es el contenedor estándar. */
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
}

export default function CetiCard({ children, variant = 'regular', style }: CetiCardProps) {
  const isHero = variant === 'hero';
  const colors = useThemeColors();

  return (
    <View style={[styles.shadowContainer, { shadowColor: '#000000' }, style]}>
      <View
        style={[
          styles.cardInner,
          {
            backgroundColor: Platform.select({
              android: colors.materials.chrome,
              default: colors.materials.base,
            }),
            borderColor: colors.materials.border,
          },
        ]}
      >
        <View style={[styles.content, isHero && styles.heroPadding]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowContainer: {
    borderRadius: BorderRadius.xl,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    alignSelf: 'stretch',
  },
  cardInner: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    flexDirection: 'column',
    alignSelf: 'stretch',
  },
  content: {
    padding: Spacing.base,
    zIndex: 1,
    alignSelf: 'stretch',
  },
  heroPadding: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing['2xl'],
  },
});
