// constants/typography.ts — Sistema tipográfico Geometric Sans (Outfit) para Ceti
import { TextStyle } from 'react-native';

export const Typography: Record<string, TextStyle> = {
  // ── DISPLAY — Números gigantes estilo Jack R. ──
  displayNumber: {
    fontFamily: 'Outfit-Bold',
    fontSize: 56,
    lineHeight: 64,
    letterSpacing: -2,
  },
  displayNumberMedium: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -1,
  },

  // ── TÍTULOS DE PANTALLA Y CARDS ────────────────
  largeTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 34,
    lineHeight: 41,
    letterSpacing: -1,
  },
  title1: {
    fontFamily: 'Outfit-Bold',
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  title2: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  title3: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },

  // ── CONTENIDO PRINCIPAL Y BOTONES ──────────────
  headline: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  body: {
    fontFamily: 'Outfit-Regular',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  buttonLarge: {
    fontFamily: 'Outfit-Medium',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
  },

  // ── LABELS SECUNDARIOS (Spatial UI look) ────────
  subheadline: {
    fontFamily: 'Outfit-Regular',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  footnote: {
    fontFamily: 'Outfit-Regular',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  },
  caption1: {
    fontFamily: 'Outfit-Medium',
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0,
  },
  caption2: {
    fontFamily: 'Outfit-Light',
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.2,
    opacity: 0.6,
  },
};

// Aliases para compatibilidad
export const Fonts = {
  heading: {
    black: 'Outfit-Bold',
    extraBold: 'Outfit-Bold',
    bold: 'Outfit-Bold',
    semiBold: 'Outfit-SemiBold',
  },
  body: {
    bold: 'Outfit-SemiBold',
    semiBold: 'Outfit-Medium',
    regular: 'Outfit-Regular',
  }
};

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 34,
  '4xl': 56,
};
