/**
 * Colores y formatos de la sección Gráficas. Gastos/ahorros usan un par
 * naranja/azul validado (dataviz validate_palette) en claro y oscuro: separable
 * con daltonismo y ≥3:1 sobre la superficie de tarjeta. Rojo/verde fallaba CVD.
 */
import type { MovimientoCategoria } from '@features/savings/store/useMovimientosStore';
import { LightColors, type ThemeColors } from '@shared/constants/colors';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';

export interface ChartPalette {
  gasto: string;
  ahorro: string;
  meta: string;
  metaTrack: string;
  cumplida: string;
  cumplidaTrack: string;
  track: string;
  grid: string;
  highlight: string;
  racha: string;
}

export function chartPalette(colors: ThemeColors): ChartPalette {
  return {
    gasto: colors.brand.primaryDark,
    ahorro: LightColors.system.blue,
    meta: LightColors.system.blue,
    metaTrack: colors.fill.blueStrong,
    cumplida: LightColors.system.green,
    cumplidaTrack: colors.fill.greenStrong,
    track: colors.materials.highlight,
    grid: colors.separator.opaque,
    highlight: colors.materials.highlight,
    racha: colors.brand.primary,
  };
}

export const CATEGORIA_EMOJI: Record<MovimientoCategoria, string> = {
  comida: '🍔',
  transporte: '🚌',
  entretenimiento: '🎮',
  ropa: '👕',
  educacion: '📚',
  tecnologia: '📱',
  regalos: '🎁',
  otros: '✨',
};

/** COP con signo para balances negativos (formatDisplayCopGoals recorta a 0). */
export function formatCopConSigno(n: number): string {
  return n < 0 ? `−${formatDisplayCopGoals(-n)}` : formatDisplayCopGoals(n);
}
