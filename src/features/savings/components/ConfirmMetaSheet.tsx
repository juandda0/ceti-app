/**
 * Confirmación de "crear meta" por voz (RQ-ES10 D-ES10-06, intención crear_meta).
 * Mínima fricción: resumen de la meta propuesta (nombre + objetivo) con
 * "Confirmar"; "Editar" sutil abre los campos si la IA entendió mal. Nada se crea
 * hasta confirmar. Reusa useSavingsStore.addGoal (metas RQ-ES08).
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import CetiButton from '@shared/components/CetiButton';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showCetiNotice } from '@shared/store/useCetiOverlayStore';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import { formatMoneyInputThousands, parseMoneyAmountInt } from '@shared/utils/moneyInputFormat';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';

export interface MetaPropuesta {
  nombre: string;
  objetivo: number;
}

export default function ConfirmMetaSheet({
  visible,
  propuesta,
  onClose,
}: {
  visible: boolean;
  propuesta: MetaPropuesta | null;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const addGoal = useSavingsStore((s) => s.addGoal);

  const [nombre, setNombre] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!visible || !propuesta) return;
    setNombre(propuesta.nombre);
    setObjetivo(
      propuesta.objetivo > 0 ? formatMoneyInputThousands(String(propuesta.objetivo)) : ''
    );
    // Si falta el nombre o el objetivo, abre directo en edición.
    setEditing(!propuesta.nombre.trim() || propuesta.objetivo <= 0);
  }, [visible, propuesta]);

  if (!propuesta) return null;

  const handleConfirm = () => {
    const num = parseMoneyAmountInt(objetivo);
    if (!nombre.trim() || !num) {
      showCetiNotice({
        variant: 'error',
        title: t('movimientos.metaReviewTitle'),
        message: t('movimientos.metaReviewMsg'),
      });
      return;
    }
    addGoal({
      title: nombre.trim().slice(0, 60),
      description: '',
      emoji: '🎯',
      targetAmount: num,
      frequency: 'total',
      category: 'custom',
    });
    showCetiNotice({
      variant: 'success',
      title: t('movimientos.metaCreadaTitle'),
      message: t('movimientos.metaCreadaMsg'),
    });
    onClose();
    router.push('/(app)/savings');
  };

  const input = [
    styles.input,
    {
      backgroundColor: colors.materials.highlight,
      color: colors.text.primary,
      borderColor: colors.materials.border,
    },
  ];

  return (
    <CetiBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('movimientos.metaConfirmTitle')}
      subtitle={t('movimientos.metaConfirmSubtitle')}
      closeOnBackdropPress
    >
      <View>
        {!editing ? (
          <View style={styles.summary}>
            <View style={[styles.badge, { backgroundColor: colors.fill.brandSubtle }]}>
              <Ionicons name="flag" size={15} color={colors.brand.primary} />
              <Text style={[styles.badgeText, { color: colors.brand.primary }]}>
                {t('movimientos.metaNueva')}
              </Text>
            </View>
            <Text style={[styles.summaryName, { color: colors.text.primary }]} numberOfLines={2}>
              {nombre}
            </Text>
            <Text style={[styles.summaryTarget, { color: colors.text.secondary }]}>
              {t('movimientos.metaObjetivo', {
                amount: formatDisplayCopGoals(parseMoneyAmountInt(objetivo)),
              })}
            </Text>
          </View>
        ) : (
          <>
            <TextInput
              style={input}
              placeholder={t('movimientos.metaNombrePlaceholder')}
              placeholderTextColor={colors.text.tertiary}
              value={nombre}
              onChangeText={setNombre}
              maxLength={60}
            />
            <TextInput
              style={input}
              placeholder={t('movimientos.metaObjetivoPlaceholder')}
              placeholderTextColor={colors.text.tertiary}
              keyboardType="numeric"
              value={objetivo}
              onChangeText={(text) => setObjetivo(formatMoneyInputThousands(text))}
            />
          </>
        )}

        {editing ? (
          <View style={styles.row}>
            <CetiButton
              label={t('movimientos.cancelar')}
              onPress={onClose}
              variant="glass"
              size="medium"
              style={{ flex: 1 }}
            />
            <CetiButton
              label={t('movimientos.metaCrear')}
              onPress={handleConfirm}
              variant="primary"
              size="medium"
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <View style={styles.actions}>
            <CetiButton
              label={t('movimientos.metaCrear')}
              onPress={handleConfirm}
              variant="primary"
              size="medium"
              style={{ alignSelf: 'stretch' }}
            />
            <TouchableOpacity
              onPress={() => setEditing(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('movimientos.editar')}
              style={styles.editLink}
            >
              <Text style={[styles.editLinkText, { color: colors.text.tertiary }]}>
                {t('movimientos.editar')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </CetiBottomSheet>
  );
}

const styles = StyleSheet.create({
  summary: { alignItems: 'center', gap: 10, paddingVertical: 12, marginBottom: 16 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  badgeText: { ...Typography.caption1, fontWeight: '800' },
  summaryName: { ...Typography.title2, fontWeight: '900', textAlign: 'center' },
  summaryTarget: { ...Typography.subheadline, fontWeight: '600' },
  input: { borderRadius: 20, padding: 20, ...Typography.body, borderWidth: 1, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actions: { gap: 6 },
  editLink: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  editLinkText: { ...Typography.subheadline, fontWeight: '600' },
});
