/**
 * Resumen "Mi dinero", solo-vista-propia (RQ-ES10 CA5 / RQ-ES11): racha +
 * insights por reglas + ahorros/gastos del mes + top categorías + topes de la
 * semana. Todo se deriva en cliente; lo único persistido son los topes (config
 * del usuario). Cero ML, cero datos para staff.
 */
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import StatTile from '@features/savings/components/StatTile';
import RachaChip from '@features/savings/components/RachaChip';
import InsightCards from '@features/savings/components/InsightCards';
import BudgetBar from '@features/savings/components/BudgetBar';
import PresupuestosSheet from '@features/savings/components/PresupuestosSheet';
import { totalesDelMes, totalesPorCategoria } from '@features/savings/data/movimientosStats';
import { gastoSemanalPorCategoria } from '@features/savings/data/presupuestos';
import { usePresupuestosStore } from '@features/savings/store/usePresupuestosStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import type { Movimiento, MovimientoCategoria } from '@features/savings/store/useMovimientosStore';

export default function MovimientosCharts({ movimientos }: { movimientos: Movimiento[] }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [topesOpen, setTopesOpen] = useState(false);
  const topes = usePresupuestosStore((s) => s.topes);
  const goals = useSavingsStore((s) => s.goals);
  const deposits = useSavingsStore((s) => s.deposits);

  const { ahorros, gastos, balance } = totalesDelMes(movimientos);
  const topCategorias = totalesPorCategoria(movimientos, 'gasto').slice(0, 3);
  const gastoSem = gastoSemanalPorCategoria(movimientos);
  const topesConValor = (Object.entries(topes) as [MovimientoCategoria, number][]).filter(
    ([, v]) => v > 0
  );

  return (
    <View style={styles.wrap}>
      <RachaChip movimientos={movimientos} />
      <InsightCards
        movimientos={movimientos}
        goals={goals}
        deposits={deposits}
        presupuestos={topes}
      />

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

      <View style={styles.topesBox}>
        <View style={styles.topesHead}>
          <Text style={[styles.catTitle, { color: colors.text.primary }]}>
            {t('presupuestos.topesTitulo')}
          </Text>
          <TouchableOpacity
            onPress={() => setTopesOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={[styles.definir, { color: colors.brand.primary }]}>
              {t('presupuestos.definir')}
            </Text>
          </TouchableOpacity>
        </View>
        {topesConValor.length === 0 ? (
          <Text style={[styles.vacio, { color: colors.text.tertiary }]}>
            {t('presupuestos.vacio')}
          </Text>
        ) : (
          topesConValor.map(([cat, tope]) => (
            <BudgetBar key={cat} categoria={cat} gastado={gastoSem[cat] ?? 0} tope={tope} />
          ))
        )}
      </View>

      <PresupuestosSheet visible={topesOpen} onClose={() => setTopesOpen(false)} />
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
  topesBox: { gap: 12, marginTop: 2 },
  topesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  definir: { ...Typography.subheadline, fontWeight: '700' },
  vacio: { ...Typography.subheadline },
});
