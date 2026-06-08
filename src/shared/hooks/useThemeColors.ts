import { useThemeStore } from '@shared/store/useThemeStore';
import { LightColors, DarkColors, ThemeColors } from '@shared/constants/colors';

export function useThemeColors(): ThemeColors {
  const mode = useThemeStore((s) => s.mode);
  return mode === 'light' ? LightColors : DarkColors;
}
