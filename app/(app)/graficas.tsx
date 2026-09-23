import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import { useMovimientosStore } from '@features/savings/store/useMovimientosStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';

export default function GraficasScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const movimientos = useMovimientosStore((state) => state.movimientos);
  const operations = useSavingsStore((state) => state.operations);
  const totals = useMemo(() => {
    const gastos = movimientos
      .filter((item) => item.tipo === 'gasto')
      .reduce((sum, item) => sum + item.monto, 0);
    const ahorros = operations
      .filter((item) => item.type === 'aporte')
      .reduce((sum, item) => sum + item.amount, 0);
    return { gastos, ahorros, max: Math.max(gastos, ahorros, 1) };
  }, [movimientos, operations]);

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('financialCharts.title')}</Text>
        <Text style={{ color: colors.text.secondary }}>{t('financialCharts.subtitle')}</Text>
        <View style={[styles.card, { backgroundColor: colors.materials.base, borderColor: colors.materials.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text.primary }]}>{t('financialCharts.month')}</Text>
          <View style={styles.row}>
            <View style={styles.barColumn}>
              <View style={[styles.bar, { height: `${(totals.gastos / totals.max) * 100}%`, backgroundColor: colors.system.red }]} />
              <Text style={{ color: colors.text.tertiary }}>{t('financialCharts.expenses')}</Text>
              <Text style={{ color: colors.text.primary, fontWeight: '800' }}>{formatDisplayCopGoals(totals.gastos)}</Text>
            </View>
            <View style={styles.barColumn}>
              <View style={[styles.bar, { height: `${(totals.ahorros / totals.max) * 100}%`, backgroundColor: colors.brand.primary }]} />
              <Text style={{ color: colors.text.tertiary }}>{t('financialCharts.savings')}</Text>
              <Text style={{ color: colors.text.primary, fontWeight: '800' }}>{formatDisplayCopGoals(totals.ahorros)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 130, gap: 18 },
  title: { fontSize: 34, fontWeight: '900' },
  card: { minHeight: 300, borderWidth: 1, borderRadius: 18, padding: 18 },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  row: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 24, paddingTop: 24 },
  barColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  bar: { width: 56, minHeight: 4, borderRadius: 12 },
});
