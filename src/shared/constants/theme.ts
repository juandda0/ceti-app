// constants/theme.ts — Sistema de espaciado y bordes Spatial UI (Clean Finance Style)
export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  '2xl':32,
  '3xl':40,
  '4xl':48,
  '5xl':64,
} as const;

export const BorderRadius = {
  xs:     8,
  sm:     12,
  md:     16,
  lg:     24,
  xl:     32, // Nueva base para cards Jack R.
  '2xl':  40,
  full:   999,
} as const;

export const Shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 12,
  },
  // Sombras sutiles sin efectos fosforescentes
  brand: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  gold: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
};

export const MinTouchTarget = 44;
