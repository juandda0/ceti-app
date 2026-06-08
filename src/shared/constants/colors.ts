// Paleta sólida, minimalista. Amarillo / oro (gold + system.yellow) sin cambios de tono base.

export const DarkColors = {
  brand: {
    primary: '#FF8A1F',
    primaryDark: '#E06E08',
    primaryLight: '#FFAE66',
    glow: '#141210',
    /** Badge sobre cabecera naranja */
    chipBackdrop: '#C46914',
    /** Texto secundario sobre cabecera naranja */
    bandSubtitle: '#3D2414',
  },
  gold: {
    primary: '#F7C95F',
    warm: '#E5A438',
    glow: '#242018',
  },
  background: {
    base: '#0E0E11',
    primary: '#141418',
    secondary: '#1A1A20',
    tertiary: '#222228',
    elevated: '#2A2A32',
  },
  materials: {
    base: '#18181F',
    highlight: '#22222A',
    chrome: '#121216',
    borderLight: '#383842',
    borderDark: '#282830',
    border: '#32323C',
    borderFocus: '#FF8A1F',
  },
  text: {
    primary: '#F2F2F4',
    secondary: '#A8A8B2',
    tertiary: '#74747E',
    quaternary: '#56565E',
    inverse: '#FFFFFF',
    onBrand: '#2B1407',
    onBrandSecondary: '#4A301C',
    onGold: '#000000',
  },
  system: {
    blue: '#5B9EF5',
    green: '#58C88C',
    red: '#F06676',
    orange: '#F3A73C',
    purple: '#A884FF',
    teal: '#5FCFC8',
    yellow: '#F7C95F',
  },
  separator: {
    opaque: '#34343E',
    transparent: '#1A1A20',
  },
  overlay: {
    /** Oscuro semitransparente detrás de modales / sheets */
    modalBackdrop: 'rgba(0, 0, 0, 0.62)',
    /** Panel del modal con ligera transparencia */
    modalSurface: 'rgba(22, 22, 30, 0.94)',
    scrim: '#0E0E11',
    scrimMuted: '#121218',
  },
  fill: {
    brandSubtle: '#271E16',
    brandStrong: '#342818',
    goldSubtle: '#2A2618',
    goldStrong: '#383222',
    greenSubtle: '#152820',
    greenStrong: '#1C3228',
    redSubtle: '#26181C',
    redStrong: '#321E24',
    blueSubtle: '#162232',
    blueStrong: '#1C2C40',
    purpleSubtle: '#221A28',
    purpleStrong: '#2C2234',
    orangeSubtle: '#2A2218',
    orangeStrong: '#362A20',
    neutralMuted: '#222228',
  },
} as const;

export const LightColors = {
  brand: {
    primary: '#FF8A1F',
    primaryDark: '#E06E08',
    primaryLight: '#FFAE66',
    glow: '#FFF4EB',
    chipBackdrop: '#FFD4A8',
    bandSubtitle: '#FFF4EC',
  },
  gold: {
    primary: '#F2B747',
    warm: '#E29A27',
    glow: '#FFF8E8',
  },
  background: {
    base: '#F4F4F6',
    primary: '#FFFFFF',
    secondary: '#EDEDF0',
    tertiary: '#E4E4EA',
    elevated: '#FFFFFF',
  },
  materials: {
    base: '#FFFFFF',
    highlight: '#F2F2F5',
    chrome: '#FFFFFF',
    borderLight: '#E8E8EE',
    borderDark: '#DCDCE2',
    border: '#D4D4DC',
    borderFocus: '#FF8A1F',
  },
  text: {
    primary: '#16161A',
    secondary: '#5A5A64',
    tertiary: '#84848E',
    quaternary: '#A4A4AE',
    inverse: '#FFFFFF',
    onBrand: '#2B1407',
    onBrandSecondary: '#5C3D26',
    onGold: '#000000',
  },
  system: {
    blue: '#3E7BD9',
    green: '#3A9B62',
    red: '#C8455C',
    orange: '#D77A1E',
    purple: '#7E58B8',
    teal: '#2F9D97',
    yellow: '#D4A033',
  },
  separator: {
    opaque: '#DCDCE4',
    transparent: '#EDEDF2',
  },
  overlay: {
    modalBackdrop: 'rgba(0, 0, 0, 0.48)',
    modalSurface: 'rgba(255, 255, 255, 0.94)',
    scrim: '#F4F4F6',
    scrimMuted: '#EBEBEF',
  },
  fill: {
    brandSubtle: '#FFF2E6',
    brandStrong: '#FFE8D4',
    goldSubtle: '#FFF6DD',
    goldStrong: '#FFECC4',
    greenSubtle: '#E8F6EC',
    greenStrong: '#D8F0E0',
    redSubtle: '#FCEAED',
    redStrong: '#FADADE',
    blueSubtle: '#EAF2FC',
    blueStrong: '#DCEAF8',
    purpleSubtle: '#F3ECFA',
    purpleStrong: '#E8DEF5',
    orangeSubtle: '#FFF4E8',
    orangeStrong: '#FFE8D4',
    neutralMuted: '#EDEDF0',
  },
} as const;

/** @deprecated Prefer `useThemeColors()`. Siempre apunta a la paleta oscura. */
export const Colors = DarkColors;

type DeepString<T> = {
  [K in keyof T]: T[K] extends object ? DeepString<T[K]> : string;
};

export type ThemeColors = DeepString<typeof DarkColors>;
