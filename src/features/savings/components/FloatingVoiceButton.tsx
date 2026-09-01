import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';

export default function FloatingVoiceButton() {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t('financialVoice.open')}
      onPress={() => router.push('/(app)/movimientos')}
      style={[styles.button, { backgroundColor: colors.brand.primary }]}
    >
      <Ionicons name="mic" size={24} color={colors.text.onBrand} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 20,
    bottom: 106,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
