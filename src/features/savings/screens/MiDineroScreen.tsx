import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import CetiButton from '@shared/components/CetiButton';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import InsightCards from '@features/savings/components/InsightCards';
import PresupuestosSheet from '@features/savings/components/PresupuestosSheet';
import { useMovimientosStore } from '@features/savings/store/useMovimientosStore';
import { usePresupuestosStore } from '@features/savings/store/usePresupuestosStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';

export default function MiDineroScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const goals = useSavingsStore((state) => state.goals);
  const operations = useSavingsStore((state) => state.operations);
  const projection = useSavingsStore((state) => state.projection)();
  const budgets = usePresupuestosStore((state) => state.topes);
  const expenses = useMovimientosStore((state) => state.movimientos).filter((item) => item.tipo === 'gasto');
  const [budgetsVisible, setBudgetsVisible] = useState(false);
  const domainGoals = goals.filter((goal) => !goal.deletedAt).map((goal) => ({
    id: goal.id, title: goal.title, iconId: goal.iconId ?? 'target', category: goal.category,
    targetAmount: goal.targetAmount, createdAt: goal.createdAt, updatedAt: goal.updatedAt ?? goal.createdAt,
    ...(goal.deadline === undefined ? {} : { deadline: goal.deadline }),
  }));

  return <ScreenWrapper>
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={[styles.title, { color: colors.text.primary }]}>{t('financialSummary.title')}</Text>
      <Text style={{ color: colors.text.secondary }}>{t('financialSummary.subtitle')}</Text>
      <View style={styles.stats}>
        <View style={[styles.stat, { backgroundColor: colors.materials.base }]}>
          <Text style={{ color: colors.text.tertiary }}>{t('financialSummary.total')}</Text>
          <Text style={[styles.amount, { color: colors.text.primary }]}>{formatDisplayCopGoals(projection.total)}</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: colors.materials.base }]}>
          <Text style={{ color: colors.text.tertiary }}>{t('financialSummary.unassigned')}</Text>
          <Text style={[styles.amount, { color: colors.text.primary }]}>{formatDisplayCopGoals(projection.unassigned)}</Text>
        </View>
      </View>
      <CetiButton label={t('financialSummary.budgets')} variant="glass" onPress={() => setBudgetsVisible(true)} />
      <InsightCards movimientos={expenses} goals={domainGoals} operations={operations} presupuestos={budgets} />
    </ScrollView>
    <PresupuestosSheet visible={budgetsVisible} onClose={() => setBudgetsVisible(false)} />
  </ScreenWrapper>;
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 130, gap: 18 }, title: { fontSize: 34, fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 12 }, stat: { flex: 1, padding: 18, borderRadius: 18, gap: 6 },
  amount: { fontSize: 20, fontWeight: '900' },
});
