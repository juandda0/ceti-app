/**
 * Sheet de captura por voz (RQ-ES10). Estilo "buscador por voz" (YouTube): vista
 * limpia sobre la superficie oscura del sheet — el texto dictado aparece grande
 * SIN caja tipo-input, con el micrófono abajo. La captura se detiene sola al
 * hacer silencio (continuous:false) y clasifica; tocar el mic la adelanta, la X
 * cancela.
 */
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';

export default function VoiceCaptureSheet({
  visible,
  processing,
  transcript,
  onStop,
  onCancel,
}: {
  visible: boolean;
  processing: boolean;
  transcript: string;
  onStop: () => void;
  onCancel: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();

  return (
    <CetiBottomSheet visible={visible} onClose={onCancel} closeOnBackdropPress={false} contentOnly>
      <View style={styles.body}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onCancel}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('movimientos.cancelar')}
          >
            <Ionicons name="close" size={26} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={[styles.status, { color: colors.text.tertiary }]}>
            {processing ? t('movimientos.processing') : t('movimientos.listeningTitle')}
          </Text>
          <Text
            style={[
              styles.transcript,
              { color: transcript ? colors.text.primary : colors.text.tertiary },
            ]}
          >
            {transcript || t('movimientos.transcriptPlaceholder')}
          </Text>
        </View>

        <View style={styles.micWrap}>
          {processing ? (
            <View style={[styles.mic, { backgroundColor: colors.materials.highlight }]}>
              <ActivityIndicator color={colors.brand.primary} />
            </View>
          ) : (
            <TouchableOpacity
              onPress={onStop}
              activeOpacity={0.85}
              style={[styles.mic, { backgroundColor: colors.system.red }]}
              accessibilityRole="button"
              accessibilityLabel={t('movimientos.listo')}
            >
              <Ionicons name="mic" size={30} color={colors.text.onBrand} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </CetiBottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { minHeight: 380, justifyContent: 'space-between' },
  header: { flexDirection: 'row', justifyContent: 'flex-start' },
  content: { flex: 1, paddingTop: 20, gap: 12 },
  status: { ...Typography.subheadline, fontWeight: '600' },
  transcript: { ...Typography.title2, fontWeight: '700', lineHeight: 32 },
  micWrap: { alignItems: 'center', paddingTop: 20 },
  mic: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
