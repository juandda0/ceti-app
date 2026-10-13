import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { enterSoftFade } from '@shared/constants/motion';
import { useTranslation } from 'react-i18next';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import type { Movimiento, MovimientoCategoria } from '@features/savings/store/useMovimientosStore';

export const CATEGORIA_ICONS: Record<MovimientoCategoria, keyof typeof Ionicons.glyphMap> = {
  comida: 'fast-food-outline',
  transporte: 'bus-outline',
  entretenimiento: 'game-controller-outline',
  ropa: 'shirt-outline',
  educacion: 'school-outline',
  tecnologia: 'phone-portrait-outline',
  regalos: 'gift-outline',
  otros: 'ellipsis-horizontal-circle-outline',
};

export default function MovimientoListItem({
  movimiento,
  showDivider,
  onDelete,
}: {
  movimiento: Movimiento;
  showDivider: boolean;
  onDelete: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const esAhorro = movimiento.tipo === 'ahorro';
  const fecha = new Date(movimiento.createdAt).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onLongPress={() => setConfirming(true)}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityHint={t('movimientos.borrarHint')}
      style={[
        styles.item,
        showDivider && { borderBottomWidth: 1, borderBottomColor: colors.materials.border },
      ]}
    >
      <Ionicons
        name={CATEGORIA_ICONS[movimiento.categoria]}
        size={20}
        color={esAhorro ? colors.system.green : colors.text.secondary}
      />
      <View style={styles.texts}>
        <Text style={[styles.desc, { color: colors.text.primary }]} numberOfLines={1}>
          {movimiento.descripcion}
        </Text>
        <Text style={[styles.meta, { color: colors.text.tertiary }]}>{fecha}</Text>
      </View>

      {confirming ? (
        <Animated.View entering={enterSoftFade()} style={styles.confirmRow}>
          <TouchableOpacity
            onPress={() => setConfirming(false)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('movimientos.cancelar')}
          >
            <Text style={[styles.confirmCancel, { color: colors.text.secondary }]}>
              {t('movimientos.cancelar')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('movimientos.borrarCorto')}
          >
            <Text style={[styles.confirmDelete, { color: colors.system.red }]}>
              {t('movimientos.borrarCorto')}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <Text
          style={[styles.amount, { color: esAhorro ? colors.system.green : colors.system.red }]}
          numberOfLines={1}
        >
          {esAhorro ? '+' : '−'}
          {formatDisplayCopGoals(movimiento.monto)}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    minHeight: 56,
  },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  desc: { ...Typography.caption1, fontWeight: '600' },
  meta: { ...Typography.caption2 },
  amount: { ...Typography.headline, fontWeight: '700', flexShrink: 0 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 4 },
  confirmCancel: { ...Typography.subheadline, fontWeight: '600' },
  confirmDelete: { ...Typography.subheadline, fontWeight: '800' },
});
