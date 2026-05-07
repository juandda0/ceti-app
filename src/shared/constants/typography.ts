// Tipografía del sistema (San Francisco / Roboto según el dispositivo).
// No se define fontFamily: React Native usa la fuente predeterminada del OS.
import { TextStyle } from 'react-native';

export const Typography: Record<string, TextStyle> = {
  displayNumber: {
    fontWeight: '700',
    fontSize: 56,
    lineHeight: 64,
    letterSpacing: -2,
  },
  displayNumberMedium: {
    fontWeight: '600',
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -1,
  },

  largeTitle: {
    fontWeight: '700',
    fontSize: 34,
    lineHeight: 41,
    letterSpacing: -1,
  },
  title1: {
    fontWeight: '700',
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  title2: {
    fontWeight: '600',
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  title3: {
    fontWeight: '600',
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },

  headline: {
    fontWeight: '600',
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  body: {
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  buttonLarge: {
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
  },

  subheadline: {
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  footnote: {
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  },
  caption1: {
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0,
  },
  caption2: {
    fontWeight: '300',
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
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
