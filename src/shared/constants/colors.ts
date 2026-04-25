// constants/colors.ts — Sistema de colores Spatial UI / VisionOS (Yellow-Orange Theme)

export const DarkColors = {
  brand: {
    primary:      '#FFB800', // Amarillo anaranjoso premium
    primaryDark:  '#CC9300', 
    primaryLight: '#FFCC33', 
    glow:         'rgba(255, 184, 0, 0.05)', 
  },
  gold: {
    primary:  '#FFD60A',
    warm:     '#FF9F0A',
    glow:     'rgba(255, 214, 10, 0.05)',
  },
  background: {
    base:     '#0A0A0C', // Casi negro industrial
    primary:  '#121214', 
    secondary:'#1A1A1D', 
    tertiary: '#252528', 
    elevated: '#2C2C2F', 
  },
  materials: {
    base:       'rgba(18, 18, 20, 0.45)',   
    highlight:  'rgba(255, 255, 255, 0.05)',
    chrome:     'rgba(18, 18, 20, 0.75)',   
    borderLight: 'rgba(255, 255, 255, 0.10)', 
    borderDark:  'rgba(255, 255, 255, 0.02)', 
    border:     'rgba(255, 255, 255, 0.08)',
    borderFocus:'rgba(255, 255, 255, 0.15)',
  },
  text: {
    primary:    '#FFFFFF',
    secondary:  'rgba(255, 255, 255, 0.85)', 
    tertiary:   'rgba(255, 255, 255, 0.65)', 
    quaternary: 'rgba(255, 255, 255, 0.40)', 
    inverse:    '#000000',
    onBrand:    '#000000', 
    onGold:     '#000000',
  },
  system: {
    blue:   '#0A84FF',
    green:  '#30D158',
    red:    '#FF453A',
    orange: '#FF9F0A',
    purple: '#BF5AF2',
    teal:   '#5AC8FA',
    yellow: '#FFD60A',
  },
  separator: {
    opaque:      'rgba(255, 255, 255, 0.12)',
    transparent: 'rgba(255, 255, 255, 0.06)',
  },
} as const;

export const LightColors = {
  brand: {
    primary:      '#FF9500', // Un naranja un poco más sólido para modo claro
    primaryDark:  '#E67E00', 
    primaryLight: '#FFB340', 
    glow:         'rgba(255, 149, 0, 0.05)', 
  },
  gold: {
    primary:  '#FFCC00',
    warm:     '#FF9500',
    glow:     'rgba(255, 204, 0, 0.05)',
  },
  background: {
    base:     '#F2F2F7', // iOS Light background
    primary:  '#FFFFFF', 
    secondary:'#F9F9F9', 
    tertiary: '#E5E5EA', 
    elevated: '#FFFFFF', 
  },
  materials: {
    base:       'rgba(255, 255, 255, 0.75)',   
    highlight:  'rgba(0, 0, 0, 0.05)',
    chrome:     'rgba(255, 255, 255, 0.85)',   
    borderLight: 'rgba(0, 0, 0, 0.05)', 
    borderDark:  'rgba(0, 0, 0, 0.02)', 
    border:     'rgba(0, 0, 0, 0.10)',
    borderFocus:'rgba(0, 0, 0, 0.20)',
  },
  text: {
    primary:    '#000000',
    secondary:  'rgba(0, 0, 0, 0.75)', 
    tertiary:   'rgba(0, 0, 0, 0.55)', 
    quaternary: 'rgba(0, 0, 0, 0.30)', 
    inverse:    '#FFFFFF',
    onBrand:    '#FFFFFF', 
    onGold:     '#000000',
  },
  system: {
    blue:   '#007AFF',
    green:  '#34C759',
    red:    '#FF3B30',
    orange: '#FF9500',
    purple: '#AF52DE',
    teal:   '#5AC8FA',
    yellow: '#FFCC00',
  },
  separator: {
    opaque:      'rgba(0, 0, 0, 0.12)',
    transparent: 'rgba(0, 0, 0, 0.06)',
  },
} as const;

// Alias para compatibilidad mientras se migran archivos
export const Colors = DarkColors;

export type ThemeColors = typeof DarkColors;
