import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import CetiButton from '@shared/components/CetiButton';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatMoneyInputThousands, parseMoneyAmountInt } from '@shared/utils/moneyInputFormat';
import { showCetiNotice } from '@shared/store/useCetiOverlayStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import type { SavingsOperation, SavingsOperationType } from '@features/savings/domain/savings';

export default function SavingsOperationSheet({
  visible,
  type,
  operation,
  preselectedGoalId,
  onClose,
}: {
  visible: boolean;
  type: SavingsOperationType;
  operation?: SavingsOperation;
  preselectedGoalId?: string;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const goals = useSavingsStore((state) => state.goals.filter((goal) => !goal.deletedAt));
  const createOperation = useSavingsStore((state) => state.createOperation);
  const updateOperation = useSavingsStore((state) => state.updateOperation);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [goalId, setGoalId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setAmount(operation ? formatMoneyInputThousands(String(operation.amount)) : '');
    setDescription(operation?.description ?? '');
    setGoalId(operation?.goalId ?? preselectedGoalId);
  }, [operation, preselectedGoalId, visible]);

  const submit = async () => {
    const parsed = parseMoneyAmountInt(amount);
    if (!parsed || saving) return;
    setSaving(true);
    const data = {
      type: operation?.type ?? type,
      amount: parsed,
      description,
      goalId,
      fecha: operation?.fecha ?? Date.now(),
    };
    const result = operation
      ? await updateOperation(operation.id, data)
      : await createOperation(data);
    setSaving(false);
    if (result.ok) onClose();
    else
      showCetiNotice({
        variant: 'error',
        title: 'No se pudo guardar',
        message:
          result.reason === 'persistence_failed'
            ? 'Revisa tu conexión e inténtalo otra vez.'
            : 'El cambio dejaría un ahorro negativo.',
      });
  };

  return (
    <CetiBottomSheet
      visible={visible}
      onClose={onClose}
      title={
        operation ? 'Editar operación' : type === 'aporte' ? 'Registrar aporte' : 'Registrar retiro'
      }
      subtitle="Este valor es autodeclarado y no representa una cuenta bancaria."
    >
      <TextInput
        accessibilityLabel="Monto en pesos"
        value={amount}
        onChangeText={(value) => setAmount(formatMoneyInputThousands(value))}
        keyboardType="numeric"
        placeholder="Monto en pesos"
        placeholderTextColor={colors.text.tertiary}
        style={[styles.input, { color: colors.text.primary, borderColor: colors.materials.border }]}
      />
      <TextInput
        accessibilityLabel="Descripción"
        value={description}
        onChangeText={setDescription}
        placeholder="Descripción opcional"
        placeholderTextColor={colors.text.tertiary}
        maxLength={140}
        style={[styles.input, { color: colors.text.primary, borderColor: colors.materials.border }]}
      />
      <Text style={{ color: colors.text.secondary, fontWeight: '700' }}>Asignar a</Text>
      <ScrollView horizontal contentContainerStyle={styles.goals}>
        <TouchableOpacity
          accessibilityRole="radio"
          accessibilityState={{ checked: !goalId }}
          onPress={() => setGoalId(undefined)}
          style={[
            styles.chip,
            { borderColor: !goalId ? colors.brand.primary : colors.materials.border },
          ]}
        >
          <Text style={{ color: colors.text.primary }}>Sin meta</Text>
        </TouchableOpacity>
        {goals.map((goal) => (
          <TouchableOpacity
            key={goal.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: goalId === goal.id }}
            onPress={() => setGoalId(goal.id)}
            style={[
              styles.chip,
              { borderColor: goalId === goal.id ? colors.brand.primary : colors.materials.border },
            ]}
          >
            <Text style={{ color: colors.text.primary }}>{goal.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.actions}>
        <CetiButton label="Cancelar" onPress={onClose} variant="glass" style={{ flex: 1 }} />
        <CetiButton
          label={saving ? 'Guardando…' : 'Guardar'}
          onPress={() => void submit()}
          disabled={saving}
          style={{ flex: 1 }}
        />
      </View>
    </CetiBottomSheet>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  goals: { gap: 8, paddingVertical: 12 },
  chip: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
});
