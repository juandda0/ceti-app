/**
 * Chip de racha de registro (RQ-ES11-CA4). Deriva la racha en cada render desde
 * los movimientos locales — no persiste nada (R5). Solo aparece con racha viva
 * (≥2 días) para no llenar de ruido a quien empieza.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { computeRacha } from '@features/savings/data/racha';
import type { Movimiento } from '@features/savings/store/useMovimientosStore';

export default function RachaChip({ movimientos }: { movimientos: Movimiento[] }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { dias, registroHoy } = computeRacha(movimientos);
  if (dias < 2) return null;

  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: colors.materials.highlight, borderColor: colors.materials.border },
      ]}
      accessibilityRole="text"
      accessibilityLabel={t('racha.dias', { dias })}
    >
      <Ionicons name="flame" size={16} color={colors.system.orange} />
      <Text style={[styles.text, { color: colors.text.primary }]}>{t('racha.dias', { dias })}</Text>
      {!registroHoy && (
        <Text style={[styles.hint, { color: colors.text.tertiary }]}>
          · {t('racha.hoyPendiente')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: { ...Typography.subheadline, fontWeight: '700' },
  hint: { ...Typography.caption1 },
});
