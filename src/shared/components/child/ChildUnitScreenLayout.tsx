import { ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import type { ThemeColors } from '@shared/constants/colors';
import { useThemeColors } from '@shared/hooks/useThemeColors';

export interface ChildUnitScreenLayoutProps {
  kicker: string;
  title: string;
  subtitle?: string;
  /** Texto pequeño arriba a la derecha en la banda (ej. 3/5 o cantidad de Cetis) */
  chip?: string;
  /** Padding horizontal del bloque bajo la banda (el mapa saga usa menos) */
  contentPadding?: number;
  /** Contenido opcional fijado arriba a la derecha en la banda (ej. botón ajustes) */
  bandAccessory?: ReactNode;
  children: React.ReactNode;
  /** Animación suave al entrar al contenido */
  animateContent?: boolean;
}

/**
 * Shell común pantallas niño: banda superior color marca (tipo Duolingo) + cuerpo claro.
 */
export default function ChildUnitScreenLayout({
  kicker,
  title,
  subtitle,
  chip,
  contentPadding = 20,
  bandAccessory,
  children,
  animateContent = true,
}: ChildUnitScreenLayoutProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = getStyles(colors, insets.top);

  const titleOnBand = colors.text.onBrand;
  const subtitleOnBand = colors.brand.bandSubtitle;

  const inner = animateContent ? (
    <Animated.View entering={motion.enterDown(24)} style={{ flexGrow: 1 }}>
      {children}
    </Animated.View>
  ) : (
    children
  );

  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <View
          style={[styles.unitBand, { backgroundColor: colors.brand.primary }]}
          pointerEvents="box-none"
        >
          {(chip != null && chip !== '') || bandAccessory ? (
            <View style={styles.bandTopRow}>
              {bandAccessory ? <View style={styles.accessory}>{bandAccessory}</View> : null}
              {chip != null && chip !== '' ? (
                <View
                  style={[
                    styles.progressChip,
                    {
                      backgroundColor: colors.brand.chipBackdrop,
                    },
                  ]}
                >
                  <Text style={[styles.progressChipText, { color: titleOnBand }]}>{chip}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <Text
            style={[
              styles.unitKicker,
              {
                color: subtitleOnBand,
                paddingRight: chip || bandAccessory ? 108 : 0,
              },
            ]}
          >
            {kicker}
          </Text>
          <Text style={[styles.unitTitle, { color: titleOnBand }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.unitSubtitle, { color: subtitleOnBand }]}>{subtitle}</Text>
          ) : null}
        </View>

        <View
          style={[
            styles.contentShell,
            {
              backgroundColor: colors.background.base,
              paddingHorizontal: contentPadding,
            },
          ]}
        >
          {inner}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const getStyles = (colors: ThemeColors, insetTop: number) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background.base },
    scroll: {
      paddingBottom: 140,
      paddingHorizontal: 0,
    },
    unitBand: {
      position: 'relative',
      zIndex: 2,
      paddingTop: Math.max(insetTop, Platform.OS === 'ios' ? 12 : 8) + 8,
      /** Espacio extra para que kicker/título/subtítulo no queden bajo el panel del cuerpo (solapamiento tipo Duolingo). */
      paddingBottom: 34,
      paddingHorizontal: 22,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
    bandTopRow: {
      position: 'absolute',
      right: 14,
      top: Math.max(insetTop, Platform.OS === 'ios' ? 12 : 8) + 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    accessory: { justifyContent: 'center', alignItems: 'center' },
    progressChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
    },
    progressChipText: {
      fontSize: 13,
      fontWeight: '900',
    },
    unitKicker: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    unitTitle: {
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.3,
      marginBottom: 6,
      maxWidth: '92%',
    },
    unitSubtitle: {
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
      maxWidth: '96%',
    },
    contentShell: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      zIndex: 1,
      /** Menos solapamiento: el fondo de la banda no se “mete” tanto detrás del panel claro. */
      marginTop: -6,
      paddingTop: 18,
      paddingBottom: 12,
      minHeight: 120,
    },
  });
