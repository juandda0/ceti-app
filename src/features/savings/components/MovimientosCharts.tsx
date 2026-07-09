/**
 * Resumen del mes, solo-vista-propia (RQ-ES10 CA5). Compactado (P0.2/P1.2):
 * 2 stat-tiles (Ahorros/Gastos) + línea de balance + top-3 categorías de gasto.
 * Sin barras normalizadas (engañan con datos escasos) ni cifras redundantes.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import StatTile from '@features/savings/components/StatTile';
import { totalesDelMes, totalesPorCategoria } from '@features/savings/data/movimientosStats';
import type { Movimiento } from '@features/savings/store/useMovimientosStore';

export default function MovimientosCharts({ movimientos }: { movimientos: Movimiento[] }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { ahorros, gastos, balance } = totalesDelMes(movimientos);
  const topCategorias = totalesPorCategoria(movimientos, 'gasto').slice(0, 3);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.scope, { color: colors.text.tertiary }]}>
        {t('movimientos.esteMes')}
      </Text>

      <View style={styles.tilesRow}>
        <StatTile
          icon="trending-up"
          label={t('movimientos.ahorros')}
          value={formatDisplayCopGoals(ahorros)}
          valueColor={colors.system.green}
          iconColor={colors.system.green}
        />
        <StatTile
          icon="trending-down"
          label={t('movimientos.gastos')}
          value={formatDisplayCopGoals(gastos)}
          valueColor={colors.system.red}
          iconColor={colors.system.red}
        />
      </View>

      <View style={[styles.balanceRow, { borderColor: colors.materials.border }]}>
        <Text style={[styles.balanceLabel, { color: colors.text.secondary }]}>
          {t('movimientos.balance')}
        </Text>
        <Text
          style={[
            styles.balanceValue,
            { color: balance >= 0 ? colors.system.green : colors.system.red },
          ]}
        >
          {balance >= 0 ? '+' : '−'}
          {formatDisplayCopGoals(Math.abs(balance))}
        </Text>
      </View>

      {topCategorias.length > 0 && (
        <View style={styles.catBox}>
          <Text style={[styles.catTitle, { color: colors.text.primary }]}>
            {t('movimientos.enQueGastaste')}
          </Text>
          {topCategorias.map(({ categoria, total }) => (
            <View key={categoria} style={styles.catRow}>
              <Text style={[styles.catLabel, { color: colors.text.secondary }]} numberOfLines={1}>
                {t(`movimientos.categorias.${categoria}`)}
              </Text>
              <Text style={[styles.catAmount, { color: colors.text.primary }]} numberOfLines={1}>
                {formatDisplayCopGoals(total)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  scope: {
    ...Typography.caption2,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tilesRow: { flexDirection: 'row', gap: 12 },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  balanceLabel: { ...Typography.subheadline, fontWeight: '700' },
  balanceValue: { ...Typography.headline, fontWeight: '900' },
  catBox: { gap: 10, marginTop: 2 },
  catTitle: { ...Typography.subheadline, fontWeight: '800' },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  catLabel: { ...Typography.body, flex: 1 },
  catAmount: { ...Typography.body, fontWeight: '700' },
});
