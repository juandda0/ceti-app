import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import CetiButton from '@shared/components/CetiButton';
import { confirmAction } from '@shared/lib/dialogs';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import Segmented from '@features/savings/components/Segmented';
import ActivityList from '@features/savings/components/ActivityList';
import InsightCards from '@features/savings/components/InsightCards';
import GoalFormSheet from '@features/savings/components/GoalFormSheet';
import ExpenseFormSheet from '@features/savings/components/ExpenseFormSheet';
import SavingsOperationSheet from '@features/savings/components/SavingsOperationSheet';
import PresupuestosSheet from '@features/savings/components/PresupuestosSheet';
import { GoalIcon } from '@features/savings/icons/GoalIcon';
import { useMovimientosStore, type Movimiento } from '@features/savings/store/useMovimientosStore';
import { useSavingsStore, type SavingsGoal } from '@features/savings/store/useSavingsStore';
import { usePresupuestosStore } from '@features/savings/store/usePresupuestosStore';
import type { SavingsOperation, SavingsOperationType } from '@features/savings/domain/savings';

type Form = 'none' | 'goal' | 'expense' | 'aporte' | 'retiro' | 'budgets';

export default function MiDineroScreen() {
  const colors = useThemeColors();
  const goals = useSavingsStore((state) => state.goals.filter((goal) => !goal.deletedAt));
  const operations = useSavingsStore((state) => state.operations);
  const budgets = usePresupuestosStore((state) => state.topes);
  const projection = useSavingsStore((state) => state.projection)();
  const deleteGoal = useSavingsStore((state) => state.deleteGoal);
  const deleteOperation = useSavingsStore((state) => state.deleteOperation);
  const expenses = useMovimientosStore((state) =>
    state.movimientos.filter((item) => item.tipo === 'gasto')
  );
  const deleteExpense = useMovimientosStore((state) => state.deleteExpense);
  const [section, setSection] = useState<'resumen' | 'actividad' | 'metas'>('resumen');
  const [filter, setFilter] = useState<'todos' | 'gastos' | 'ahorros'>('todos');
  const [form, setForm] = useState<Form>('none');
  const [editingGoal, setEditingGoal] = useState<SavingsGoal>();
  const [editingExpense, setEditingExpense] = useState<Movimiento>();
  const [editingOperation, setEditingOperation] = useState<SavingsOperation>();
  const domainGoals = goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    iconId: goal.iconId ?? ('target' as const),
    category: goal.category,
    targetAmount: goal.targetAmount,
    ...(goal.deadline === undefined ? {} : { deadline: goal.deadline }),
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt ?? goal.createdAt,
  }));

  const closeForms = () => {
    setForm('none');
    setEditingGoal(undefined);
    setEditingExpense(undefined);
    setEditingOperation(undefined);
  };
  const confirmGoalDelete = (goal: SavingsGoal) =>
    confirmAction({
      title: 'Eliminar meta',
      body: `${formatDisplayCopGoals(projection.byGoal[goal.id] ?? 0)} quedará como ahorro sin asignar.`,
      confirmLabel: 'Eliminar meta',
      cancelLabel: 'Cancelar',
      destructive: true,
      onConfirm: () => void deleteGoal(goal.id),
    });
  const confirmExpenseDelete = (expense: Movimiento) =>
    confirmAction({
      title: 'Eliminar gasto',
      body: 'Se quitará del historial y de los análisis de gastos.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      destructive: true,
      onConfirm: () => void deleteExpense(expense.id),
    });
  const confirmOperationDelete = (operation: SavingsOperation) =>
    confirmAction({
      title: 'Eliminar operación',
      body: 'El ahorro y el progreso de la meta se recalcularán.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      destructive: true,
      onConfirm: () => void deleteOperation(operation.id),
    });

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={[styles.title, { color: colors.text.primary }]}>Mi dinero</Text>
        <Text style={{ color: colors.text.secondary }}>
          Administra valores autodeclarados. Ceti no guarda ni mueve tu dinero.
        </Text>
        <Segmented
          options={[
            { key: 'resumen', label: 'Resumen' },
            { key: 'actividad', label: 'Actividad' },
            { key: 'metas', label: 'Metas' },
          ]}
          value={section}
          onChange={setSection}
        />
        {section === 'resumen' && (
          <>
            <View style={styles.stats}>
              <View style={[styles.stat, { backgroundColor: colors.materials.base }]}>
                <Text style={{ color: colors.text.tertiary }}>Ahorro total</Text>
                <Text style={[styles.amount, { color: colors.text.primary }]}>
                  {formatDisplayCopGoals(projection.total)}
                </Text>
              </View>
              <View style={[styles.stat, { backgroundColor: colors.materials.base }]}>
                <Text style={{ color: colors.text.tertiary }}>Sin asignar</Text>
                <Text style={[styles.amount, { color: colors.text.primary }]}>
                  {formatDisplayCopGoals(projection.unassigned)}
                </Text>
              </View>
            </View>
            <CetiButton
              label="Configurar topes"
              variant="glass"
              onPress={() => setForm('budgets')}
            />
            <InsightCards
              movimientos={expenses}
              goals={domainGoals}
              operations={operations}
              presupuestos={budgets}
            />
          </>
        )}
        {section === 'actividad' && (
          <>
            <Segmented
              options={[
                { key: 'todos', label: 'Todos' },
                { key: 'gastos', label: 'Gastos' },
                { key: 'ahorros', label: 'Ahorros' },
              ]}
              value={filter}
              onChange={setFilter}
            />
            <ActivityList
              expenses={expenses}
              operations={operations}
              filter={filter}
              onEditExpense={(item) => {
                setEditingExpense(item);
                setForm('expense');
              }}
              onEditOperation={(item) => {
                setEditingOperation(item);
                setForm(item.type);
              }}
              onDeleteExpense={confirmExpenseDelete}
              onDeleteOperation={confirmOperationDelete}
            />
          </>
        )}
        {section === 'metas' && (
          <>
            <CetiButton label="Nueva meta" onPress={() => setForm('goal')} />
            {goals.map((goal) => (
              <View key={goal.id} style={[styles.goal, { borderColor: colors.materials.border }]}>
                <GoalIcon id={goal.iconId ?? 'target'} color={colors.brand.primary} />
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => {
                    setEditingGoal(goal);
                    setForm('goal');
                  }}
                >
                  <Text style={{ color: colors.text.primary, fontWeight: '800' }}>
                    {goal.title}
                  </Text>
                  <Text style={{ color: colors.text.tertiary }}>
                    {formatDisplayCopGoals(projection.byGoal[goal.id] ?? 0)} de{' '}
                    {formatDisplayCopGoals(goal.targetAmount)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel={`Aportar a ${goal.title}`}
                  onPress={() => {
                    setEditingGoal(goal);
                    setForm('aporte');
                  }}
                >
                  <Ionicons name="add-circle-outline" size={24} color={colors.brand.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel={`Eliminar ${goal.title}`}
                  onPress={() => confirmGoalDelete(goal)}
                >
                  <Ionicons name="trash-outline" size={22} color={colors.system.red} />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
        <View style={styles.register}>
          <Text style={{ color: colors.text.primary, fontWeight: '800' }}>Registrar</Text>
          <View style={styles.actions}>
            <CetiButton label="Gasto" onPress={() => setForm('expense')} style={{ flex: 1 }} />
            <CetiButton label="Aporte" onPress={() => setForm('aporte')} style={{ flex: 1 }} />
            <CetiButton label="Retiro" onPress={() => setForm('retiro')} style={{ flex: 1 }} />
          </View>
          <CetiButton
            label="Registrar por voz"
            icon="mic-outline"
            variant="glass"
            onPress={() => router.push('/(app)/movimientos')}
          />
        </View>
      </ScrollView>
      <GoalFormSheet visible={form === 'goal'} goal={editingGoal} onClose={closeForms} />
      <ExpenseFormSheet
        visible={form === 'expense'}
        expense={editingExpense}
        onClose={closeForms}
      />
      <SavingsOperationSheet
        visible={form === 'aporte' || form === 'retiro'}
        type={(form === 'retiro' ? 'retiro' : 'aporte') as SavingsOperationType}
        operation={editingOperation}
        preselectedGoalId={editingGoal?.id}
        onClose={closeForms}
      />
      <PresupuestosSheet visible={form === 'budgets'} onClose={closeForms} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 130, gap: 18 },
  title: { fontSize: 34, fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, padding: 18, borderRadius: 18, gap: 6 },
  amount: { fontSize: 20, fontWeight: '900' },
  goal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  register: { gap: 10 },
  actions: { flexDirection: 'row', gap: 8 },
});
