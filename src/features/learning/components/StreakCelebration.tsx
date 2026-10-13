/**
 * Celebración de racha: aparece al terminar el primer quiz del día. Muestra el
 * fueguito (se llena, tiembla y explota) y el número de días.
 */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CetiAnimation } from '@features/animations';
import { BrandColors } from '@shared/constants/colors';

export default function StreakCelebration({
  racha,
  visible,
  onClose,
}: {
  racha: number;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <CetiAnimation id="streak.fueguito" size={300} />
        <Text style={styles.count}>{Math.max(1, racha)}</Text>
        <Text style={styles.label}>
          {racha <= 1 ? t('quiz.streakLabelOne') : t('quiz.streakLabel')}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.button, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.buttonText}>{t('quiz.streakContinue')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#0E0F13',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  count: {
    fontSize: 96,
    lineHeight: 104,
    fontWeight: '900',
    color: BrandColors.orange,
    textAlign: 'center',
    marginTop: -8,
  },
  label: { fontSize: 24, fontWeight: '800', textAlign: 'center', color: '#FFFFFF' },
  button: {
    marginTop: 28,
    alignSelf: 'center',
    maxWidth: 420,
    width: '100%',
    backgroundColor: BrandColors.orange,
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
});
