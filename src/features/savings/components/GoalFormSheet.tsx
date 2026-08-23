import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import CetiButton from '@shared/components/CetiButton';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatMoneyInputThousands, parseMoneyAmountInt } from '@shared/utils/moneyInputFormat';
import { showCetiNotice } from '@shared/store/useCetiOverlayStore';
import { useSavingsStore, type SavingsGoal } from '@features/savings/store/useSavingsStore';
import { GOAL_ICON_IDS, GoalIcon, type GoalIconId } from '@features/savings/icons/GoalIcon';

export default function GoalFormSheet({
  visible,
  goal,
  onClose,
}: {
  visible: boolean;
  goal?: SavingsGoal;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const createGoal = useSavingsStore((state) => state.createGoal);
  const updateGoal = useSavingsStore((state) => state.updateGoal);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [iconId, setIconId] = useState<GoalIconId>('target');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(goal?.title ?? '');
    setTarget(goal ? formatMoneyInputThousands(String(goal.targetAmount)) : '');
    setIconId(goal?.iconId ?? 'target');
  }, [goal, visible]);

  const submit = async () => {
    const targetAmount = parseMoneyAmountInt(target);
    if (!title.trim() || !targetAmount || saving) return;
    setSaving(true);
    const result = goal
      ? await updateGoal(goal.id, { title, targetAmount, iconId })
      : await createGoal({ title, targetAmount, iconId, category: 'custom' });
    setSaving(false);
    if (result.ok) onClose();
    else
      showCetiNotice({
        variant: 'error',
        title: t('movimientos.errorTitle'),
        message: t('movimientos.errorMsg'),
      });
  };

  return (
    <CetiBottomSheet
      visible={visible}
      onClose={onClose}
      title={goal ? 'Editar meta' : 'Nueva meta'}
      subtitle="Define un objetivo para tu ahorro autodeclarado."
    >
      <TextInput
        accessibilityLabel="Nombre de la meta"
        value={title}
        onChangeText={setTitle}
        placeholder="Nombre de la meta"
        placeholderTextColor={colors.text.tertiary}
        style={[styles.input, { color: colors.text.primary, borderColor: colors.materials.border }]}
      />
      <TextInput
        accessibilityLabel="Objetivo en pesos"
        value={target}
        onChangeText={(value) => setTarget(formatMoneyInputThousands(value))}
        keyboardType="numeric"
        placeholder="Objetivo en pesos"
        placeholderTextColor={colors.text.tertiary}
        style={[styles.input, { color: colors.text.primary, borderColor: colors.materials.border }]}
      />
      <Text style={{ color: colors.text.secondary, fontWeight: '700' }}>Icono</Text>
      <ScrollView horizontal contentContainerStyle={styles.icons}>
        {GOAL_ICON_IDS.map((id) => (
          <TouchableOpacity
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ checked: iconId === id }}
            accessibilityLabel={`Icono ${id}`}
            onPress={() => setIconId(id)}
            style={[
              styles.icon,
              { borderColor: iconId === id ? colors.brand.primary : colors.materials.border },
            ]}
          >
            <GoalIcon id={id} color={colors.text.primary} />
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
  icons: { gap: 8, paddingVertical: 12 },
  icon: { borderWidth: 2, borderRadius: 14, padding: 10 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
});
