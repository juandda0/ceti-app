import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import type { VoiceState } from '@features/savings/hooks/useVoiceCapture';

export default function MicButton({
  state,
  processing,
  onStart,
  onStop,
}: {
  state: VoiceState;
  processing: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const listening = state === 'listening';
  const disabled = state !== 'idle' && !listening;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: listening ? colors.system.red : colors.brand.primary },
          (disabled || processing) && { opacity: 0.4 },
        ]}
        onPress={listening ? onStop : onStart}
        disabled={disabled || processing}
        accessibilityRole="button"
        accessibilityLabel={listening ? t('movimientos.micListening') : t('movimientos.micStart')}
      >
        <Ionicons name={listening ? 'stop' : 'mic'} size={40} color={colors.text.onBrand} />
      </TouchableOpacity>
      <Text style={[styles.hint, { color: colors.text.secondary }]}>
        {processing
          ? t('movimientos.processing')
          : listening
            ? t('movimientos.micListening')
            : t('movimientos.micHint')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12 },
  button: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { ...Typography.subheadline, textAlign: 'center' },
});
