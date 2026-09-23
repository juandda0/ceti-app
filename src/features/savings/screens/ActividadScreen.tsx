import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import Segmented from '@features/savings/components/Segmented';
import ActivityList from '@features/savings/components/ActivityList';
import ExpenseFormSheet from '@features/savings/components/ExpenseFormSheet';
import SavingsOperationSheet from '@features/savings/components/SavingsOperationSheet';
import { confirmAction } from '@shared/lib/dialogs';
import { useMovimientosStore, type Movimiento } from '@features/savings/store/useMovimientosStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import type { SavingsOperation, SavingsOperationType } from '@features/savings/domain/savings';

type Form = 'none' | 'expense' | SavingsOperationType;

export default function ActividadScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const expenses = useMovimientosStore((state) => state.movimientos).filter((item) => item.tipo === 'gasto');
  const deleteExpense = useMovimientosStore((state) => state.deleteExpense);
  const operations = useSavingsStore((state) => state.operations);
  const deleteOperation = useSavingsStore((state) => state.deleteOperation);
  const [filter, setFilter] = useState<'todos' | 'gastos' | 'ahorros'>('todos');
  const [form, setForm] = useState<Form>('none');
  const [editingExpense, setEditingExpense] = useState<Movimiento>();
  const [editingOperation, setEditingOperation] = useState<SavingsOperation>();
  const closeForms = () => { setForm('none'); setEditingExpense(undefined); setEditingOperation(undefined); };

  return <ScreenWrapper>
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={[styles.title, { color: colors.text.primary }]}>{t('financialActivity.title')}</Text>
      <Text style={{ color: colors.text.secondary }}>{t('financialActivity.subtitle')}</Text>
      <Segmented options={[
        { key: 'todos', label: t('financialActivity.all') },
        { key: 'gastos', label: t('financialActivity.expenses') },
        { key: 'ahorros', label: t('financialActivity.savings') },
      ]} value={filter} onChange={setFilter} />
      <ActivityList expenses={expenses} operations={operations} filter={filter}
        onEditExpense={(expense) => { setEditingExpense(expense); setForm('expense'); }}
        onEditOperation={(operation) => { setEditingOperation(operation); setForm(operation.type); }}
        onDeleteExpense={(expense) => confirmAction({ title: t('financialActivity.deleteExpenseTitle'), body: t('financialActivity.deleteExpenseBody'), confirmLabel: t('financialActivity.delete'), cancelLabel: t('financialActivity.cancel'), destructive: true, onConfirm: () => void deleteExpense(expense.id) })}
        onDeleteOperation={(operation) => confirmAction({ title: t('financialActivity.deleteOperationTitle'), body: t('financialActivity.deleteOperationBody'), confirmLabel: t('financialActivity.delete'), cancelLabel: t('financialActivity.cancel'), destructive: true, onConfirm: () => void deleteOperation(operation.id) })} />
    </ScrollView>
    <ExpenseFormSheet visible={form === 'expense'} expense={editingExpense} onClose={closeForms} />
    <SavingsOperationSheet visible={form === 'aporte' || form === 'retiro'} type={(form === 'retiro' ? 'retiro' : 'aporte') as SavingsOperationType} operation={editingOperation} onClose={closeForms} />
  </ScreenWrapper>;
}

const styles = StyleSheet.create({ page: { padding: 20, paddingBottom: 130, gap: 18 }, title: { fontSize: 34, fontWeight: '900' } });
