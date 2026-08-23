import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, Text, View } from 'react-native';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import CetiButton from '@shared/components/CetiButton';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatMoneyInputThousands, parseMoneyAmountInt } from '@shared/utils/moneyInputFormat';
import { showCetiNotice } from '@shared/store/useCetiOverlayStore';
import {
  MOVIMIENTO_CATEGORIAS,
  useMovimientosStore,
  type Movimiento,
  type MovimientoCategoria,
  type MovimientoOrigen,
} from '@features/savings/store/useMovimientosStore';

export default function ExpenseFormSheet({
  visible,
  expense,
  origen = 'manual',
  onClose,
}: {
  visible: boolean;
  expense?: Movimiento;
  origen?: MovimientoOrigen;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const createExpense = useMovimientosStore((state) => state.createExpense);
  const updateExpense = useMovimientosStore((state) => state.updateExpense);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<MovimientoCategoria>('otros');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setAmount(expense ? formatMoneyInputThousands(String(expense.monto)) : '');
    setDescription(expense?.descripcion ?? '');
    setCategory(expense?.categoria ?? 'otros');
  }, [expense, visible]);

  const submit = async () => {
    const monto = parseMoneyAmountInt(amount);
    if (!monto || !description.trim() || saving) return;
    setSaving(true);
    const result = expense
      ? await updateExpense(expense.id, { monto, descripcion: description, categoria: category })
      : await createExpense({
          tipo: 'gasto',
          monto,
          descripcion: description,
          categoria: category,
          origen,
          fecha: Date.now(),
        });
    setSaving(false);
    if (result.ok) onClose();
    else
      showCetiNotice({
        variant: 'error',
        title: 'No se pudo guardar',
        message: 'Revisa los datos y vuelve a intentarlo.',
      });
  };

  return (
    <CetiBottomSheet
      visible={visible}
      onClose={onClose}
      title={expense ? 'Editar gasto' : 'Registrar gasto'}
      subtitle="Los gastos no descuentan tus ahorros."
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
        placeholder="¿En qué gastaste?"
        placeholderTextColor={colors.text.tertiary}
        maxLength={140}
        style={[styles.input, { color: colors.text.primary, borderColor: colors.materials.border }]}
      />
      <ScrollView horizontal contentContainerStyle={styles.categories}>
        {MOVIMIENTO_CATEGORIAS.map((item) => (
          <TouchableOpacity
            key={item}
            accessibilityRole="radio"
            accessibilityState={{ checked: category === item }}
            onPress={() => setCategory(item)}
            style={[
              styles.chip,
              { borderColor: category === item ? colors.brand.primary : colors.materials.border },
            ]}
          >
            <Text style={{ color: colors.text.primary }}>{item}</Text>
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
  categories: { gap: 8, paddingVertical: 12 },
  chip: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
});
