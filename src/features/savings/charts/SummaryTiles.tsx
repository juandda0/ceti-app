/**
 * Encabezado: tres cifras (gastaste / ahorraste / te queda) + una frase amigable.
 * Es un stat-tile, no un gráfico: el número es el mensaje.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import type { InsightGrafica, PeriodoGrafica, Resumen } from './chartData';
import { formatCopConSigno, type ChartPalette } from './chartTheme';

function insightTexto(
  t: (k: string, o?: Record<string, unknown>) => string,
  i: InsightGrafica,
  periodo: PeriodoGrafica
): string {
  const suf = periodo === 'mes' ? 'mes' : 'semana';
  switch (i.key) {
    case 'menos':
    case 'mas':
      return t(`graficasSeccion.insight.${i.key}_${suf}`, { pct: i.pct });
    case 'igual':
    case 'arranque':
      return t(`graficasSeccion.insight.${i.key}_${suf}`);
    default:
      return t(`graficasSeccion.insight.${i.key}`);
  }
}

export default function SummaryTiles({
  resumen,
  insight,
  periodo,
  palette,
}: {
  resumen: Resumen;
  insight: InsightGrafica;
  periodo: PeriodoGrafica;
  palette: ChartPalette;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const negativo = resumen.balance < 0;

  const tile = (label: string, value: string, swatch?: string) => (
    <View
      style={[
        styles.tile,
        { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
      ]}
    >
      <View style={styles.tileLabelRow}>
        {swatch ? <View style={[styles.swatch, { backgroundColor: swatch }]} /> : null}
        <Text numberOfLines={1} style={[styles.tileLabel, { color: colors.text.tertiary }]}>
          {label}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={[styles.tileValue, { color: colors.text.primary }]}
      >
        {value}
      </Text>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {tile(t('graficasSeccion.gastado'), formatDisplayCopGoals(resumen.gastado), palette.gasto)}
        {tile(t('graficasSeccion.ahorrado'), formatCopConSigno(resumen.ahorrado), palette.ahorro)}
        {tile(
          negativo ? t('graficasSeccion.balanceNegativo') : t('graficasSeccion.balance'),
          formatDisplayCopGoals(Math.abs(resumen.balance))
        )}
      </View>
      <View style={[styles.insight, { backgroundColor: colors.fill.brandSubtle }]}>
        <Text style={[styles.insightText, { color: colors.text.primary }]}>
          {insightTexto(t, insight, periodo)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 4,
  },
  tileLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 8, height: 8, borderRadius: 4 },
  tileLabel: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  tileValue: { fontSize: 18, fontWeight: '900' },
  insight: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  insightText: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
});
