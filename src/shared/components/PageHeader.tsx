// components/common/PageHeader.tsx — Cabeceras Premium y Divertidas (Senior UI)
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  overline?: string;
  style?: ViewStyle;
}

export default function PageHeader({ title, subtitle, overline, style }: PageHeaderProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, style]}>
      {overline && (
        <View style={styles.overlineRow}>
          <View style={[styles.overlineDot, { backgroundColor: colors.brand.primary, shadowColor: colors.brand.primary }]} />
          <Text style={[styles.overlineText, { color: colors.brand.primary }]}>{overline.toUpperCase()}</Text>
        </View>
      )}
      
      <View style={styles.titleRow}>
        <Text style={[styles.titleText, { color: colors.text.primary }]}>{title}</Text>
      </View>

      {subtitle && (
        <Text style={[styles.subtitleText, { color: colors.text.secondary }]}>{subtitle}</Text>
      )}

      {/* Acento Visual Premium: Una línea de brillo sutil abajo */}
      <View style={[styles.accentLine, { backgroundColor: colors.separator.transparent }]}>
        <View style={[styles.accentGlow, { backgroundColor: colors.brand.primary }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
    marginBottom: 8,
  },
  overlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  overlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  overlineText: {
    ...Typography.caption1,
    letterSpacing: 2,
    fontWeight: '800',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    ...Typography.largeTitle,
    fontWeight: '900',
  },
  subtitleText: {
    ...Typography.subheadline,
    lineHeight: 20,
    marginTop: 2,
  },
  accentLine: {
    height: 3,
    width: 40,
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  accentGlow: {
    height: '100%',
    width: '60%',
    borderRadius: 2,
    opacity: 0.6,
  },
});
