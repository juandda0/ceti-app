import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import CetiButton from '@shared/components/CetiButton';
import { confirmAction } from '@shared/lib/dialogs';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import GoalFormSheet from '@features/savings/components/GoalFormSheet';
import SavingsOperationSheet from '@features/savings/components/SavingsOperationSheet';
import { GoalIcon } from '@features/savings/icons/GoalIcon';
import { useSavingsStore, type SavingsGoal } from '@features/savings/store/useSavingsStore';

type Form = 'none' | 'goal' | 'aporte';

export default function MetasScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const goals = useSavingsStore((state) => state.goals).filter((goal) => !goal.deletedAt);
  const projection = useSavingsStore((state) => state.projection)();
  const deleteGoal = useSavingsStore((state) => state.deleteGoal);
  const [form, setForm] = useState<Form>('none');
  const [editingGoal, setEditingGoal] = useState<SavingsGoal>();
  const closeForms = () => { setForm('none'); setEditingGoal(undefined); };

  return <ScreenWrapper>
    <ContextScrollView contentContainerStyle={styles.page}>
      <Text style={[styles.title, { color: colors.text.primary }]}>{t('financialGoals.title')}</Text>
      <Text style={{ color: colors.text.secondary }}>{t('financialGoals.subtitle')}</Text>
      <CetiButton label={t('financialGoals.new')} onPress={() => setForm('goal')} />
      {goals.map((goal) => <View key={goal.id} style={[styles.goal, { borderColor: colors.materials.border }]}>
        <GoalIcon id={goal.iconId ?? 'target'} color={colors.brand.primary} />
        <TouchableOpacity style={{ flex: 1 }} onPress={() => { setEditingGoal(goal); setForm('goal'); }} accessibilityRole="button" accessibilityLabel={t('financialGoals.edit', { title: goal.title })}>
          <Text style={{ color: colors.text.primary, fontWeight: '800' }}>{goal.title}</Text>
          <Text style={{ color: colors.text.tertiary }}>{t('financialGoals.progress', { current: formatDisplayCopGoals(projection.byGoal[goal.id] ?? 0), target: formatDisplayCopGoals(goal.targetAmount) })}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('financialGoals.contribute', { title: goal.title })} onPress={() => { setEditingGoal(goal); setForm('aporte'); }}>
          <Ionicons name="add-circle-outline" size={24} color={colors.brand.primary} />
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('financialGoals.deleteGoal', { title: goal.title })} onPress={() => confirmAction({ title: t('financialGoals.deleteTitle'), body: t('financialGoals.deleteBody', { amount: formatDisplayCopGoals(projection.byGoal[goal.id] ?? 0) }), confirmLabel: t('financialGoals.delete'), cancelLabel: t('financialGoals.cancel'), destructive: true, onConfirm: () => void deleteGoal(goal.id) })}>
          <Ionicons name="trash-outline" size={22} color={colors.system.red} />
        </TouchableOpacity>
      </View>)}
    </ContextScrollView>
    <GoalFormSheet visible={form === 'goal'} goal={editingGoal} onClose={closeForms} />
    <SavingsOperationSheet visible={form === 'aporte'} type="aporte" preselectedGoalId={editingGoal?.id} onClose={closeForms} />
  </ScreenWrapper>;
}

const styles = StyleSheet.create({ page: { padding: 20, paddingBottom: 130, gap: 18 }, title: { fontSize: 34, fontWeight: '900' }, goal: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14 } });
