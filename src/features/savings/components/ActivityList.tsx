import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { enterFadeUp, listExit, listLayout } from '@shared/constants/motion';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import type { Movimiento } from '@features/savings/store/useMovimientosStore';
import type { SavingsOperation } from '@features/savings/domain/savings';

export type ActivityItem =
  | { kind: 'gasto'; id: string; date: number; expense: Movimiento }
  | { kind: 'ahorro'; id: string; date: number; operation: SavingsOperation };

export function buildActivity(
  expenses: Movimiento[],
  operations: SavingsOperation[]
): ActivityItem[] {
  return [
    ...expenses.map(
      (expense): ActivityItem => ({
        kind: 'gasto',
        id: expense.id,
        date: expense.fecha ?? expense.createdAt,
        expense,
      })
    ),
    ...operations.map(
      (operation): ActivityItem => ({
        kind: 'ahorro',
        id: operation.id,
        date: operation.fecha,
        operation,
      })
    ),
  ].sort((a, b) => b.date - a.date);
}

export default function ActivityList({
  expenses,
  operations,
  filter,
  onEditExpense,
  onEditOperation,
  onDeleteExpense,
  onDeleteOperation,
}: {
  expenses: Movimiento[];
  operations: SavingsOperation[];
  filter: 'todos' | 'gastos' | 'ahorros';
  onEditExpense: (expense: Movimiento) => void;
  onEditOperation: (operation: SavingsOperation) => void;
  onDeleteExpense: (expense: Movimiento) => void;
  onDeleteOperation: (operation: SavingsOperation) => void;
}) {
  const colors = useThemeColors();
  const items = buildActivity(expenses, operations).filter(
    (item) =>
      filter === 'todos' || (filter === 'gastos' ? item.kind === 'gasto' : item.kind === 'ahorro')
  );
  if (items.length === 0)
    return (
      <Text style={{ color: colors.text.tertiary, textAlign: 'center', padding: 24 }}>
        Aún no hay actividad.
      </Text>
    );
  return (
    <View style={[styles.box, { borderColor: colors.materials.border }]}>
      {items.map((item, index) => {
        const isExpense = item.kind === 'gasto';
        const amount = isExpense ? item.expense.monto : item.operation.amount;
        const label = isExpense
          ? item.expense.descripcion
          : item.operation.description || (item.operation.type === 'aporte' ? 'Aporte' : 'Retiro');
        const sign = isExpense || (!isExpense && item.operation.type === 'retiro') ? '−' : '+';
        return (
          <Animated.View
            key={item.id}
            entering={enterFadeUp(index)}
            exiting={listExit}
            layout={listLayout}
            style={[styles.row, { borderBottomColor: colors.materials.border }]}
          >
            <Ionicons
              name={isExpense ? 'receipt-outline' : 'wallet-outline'}
              size={22}
              color={isExpense ? colors.system.red : colors.system.green}
            />
            <TouchableOpacity
              style={styles.text}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${label}`}
              onPress={() =>
                isExpense ? onEditExpense(item.expense) : onEditOperation(item.operation)
              }
            >
              <Text numberOfLines={1} style={{ color: colors.text.primary, fontWeight: '700' }}>
                {label}
              </Text>
              <Text style={{ color: colors.text.tertiary }}>
                {new Date(item.date).toLocaleDateString('es-CO')}
              </Text>
            </TouchableOpacity>
            <Text
              style={{
                color: sign === '+' ? colors.system.green : colors.system.red,
                fontWeight: '800',
              }}
            >
              {sign}
              {formatDisplayCopGoals(amount)}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Eliminar ${label}`}
              onPress={() =>
                isExpense ? onDeleteExpense(item.expense) : onDeleteOperation(item.operation)
              }
            >
              <Ionicons name="trash-outline" size={20} color={colors.system.red} />
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1 },
  text: { flex: 1, gap: 2 },
});
