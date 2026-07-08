/**
 * Dashboard solo-vista-propia (RQ-ES10 CA5): totales del mes, ahorro vs gasto
 * y desglose por categoría de gasto. Barras con Views, el mismo patrón de las
 * barras de progreso de metas — sin librerías de charts.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import { totalesDelMes, totalesPorCategoria } from '@features/savings/data/movimientosStats';
import type { Movimiento } from '@features/savings/store/useMovimientosStore';

export default function MovimientosCharts({ movimientos }: { movimientos: Movimiento[] }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { ahorros, gastos, balance } = totalesDelMes(movimientos);
  const porCategoria = totalesPorCategoria(movimientos, 'gasto');
  const totalMes = ahorros + gastos;
  const maxCategoria = porCategoria[0]?.total ?? 0;

  const card = [
    styles.card,
    { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.totalsRow}>
        <View style={card}>
          <Ionicons name="trending-up" size={18} color={colors.system.green} />
          <Text style={[styles.totalLabel, { color: colors.text.tertiary }]}>
            {t('movimientos.ahorros')}
          </Text>
          <Text style={[styles.totalValue, { color: colors.system.green }]} numberOfLines={1}>
            {formatDisplayCopGoals(ahorros)}
          </Text>
        </View>
        <View style={card}>
          <Ionicons name="trending-down" size={18} color={colors.system.red} />
          <Text style={[styles.totalLabel, { color: colors.text.tertiary }]}>
            {t('movimientos.gastos')}
          </Text>
          <Text style={[styles.totalValue, { color: colors.system.red }]} numberOfLines={1}>
            {formatDisplayCopGoals(gastos)}
          </Text>
        </View>
        <View style={card}>
          <Ionicons name="scale-outline" size={18} color={colors.brand.primary} />
          <Text style={[styles.totalLabel, { color: colors.text.tertiary }]}>
            {t('movimientos.balance')}
          </Text>
          <Text
            style={[
              styles.totalValue,
              { color: balance >= 0 ? colors.system.green : colors.system.red },
            ]}
            numberOfLines={1}
          >
            {formatDisplayCopGoals(balance)}
          </Text>
        </View>
      </View>

      {totalMes > 0 && (
        <View style={styles.dualBarWrap}>
          <View style={[styles.dualBar, { backgroundColor: colors.materials.highlight }]}>
            <View
              style={[
                styles.dualFill,
                {
                  backgroundColor: colors.system.green,
                  flex: ahorros / totalMes,
                },
              ]}
            />
            <View
              style={[
                styles.dualFill,
                {
                  backgroundColor: colors.system.red,
                  flex: gastos / totalMes,
                },
              ]}
            />
          </View>
          <Text style={[styles.dualCaption, { color: colors.text.tertiary }]}>
            {t('movimientos.ahorroVsGasto')}
          </Text>
        </View>
      )}

      {porCategoria.length > 0 && (
        <View style={styles.categoriasBox}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            {t('movimientos.porCategoria')}
          </Text>
          {porCategoria.map(({ categoria, total }) => (
            <View key={categoria} style={styles.catRow}>
              <Text style={[styles.catLabel, { color: colors.text.secondary }]} numberOfLines={1}>
                {t(`movimientos.categorias.${categoria}`)}
              </Text>
              <View style={[styles.catBarBg, { backgroundColor: colors.materials.highlight }]}>
                <View
                  style={[
                    styles.catBarFill,
                    {
                      backgroundColor: colors.brand.primary,
                      width: `${maxCategoria > 0 ? (total / maxCategoria) * 100 : 0}%`,
                    },
                  ]}
                />
              </View>
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
  wrap: { gap: 16 },
  totalsRow: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 4,
    alignItems: 'flex-start',
  },
  totalLabel: {
    ...Typography.caption2,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  totalValue: { ...Typography.headline, fontWeight: '900', fontSize: 15 },
  dualBarWrap: { gap: 6 },
  dualBar: {
    height: 14,
    borderRadius: 7,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  dualFill: { height: '100%' },
  dualCaption: { ...Typography.caption2, textAlign: 'center' },
  categoriasBox: { gap: 10 },
  sectionTitle: { ...Typography.title3, fontWeight: '800' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catLabel: { ...Typography.caption1, width: 110 },
  catBarBg: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 5 },
  catAmount: { ...Typography.caption1, fontWeight: '700', minWidth: 70, textAlign: 'right' },
});
