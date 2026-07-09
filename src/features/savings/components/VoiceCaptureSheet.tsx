/**
 * Sheet de captura por voz (RQ-ES10): al tocar el micrófono se abre y muestra
 * EN VIVO lo que la persona va diciendo; al tocar "Listo" se clasifica (spinner)
 * y luego se abre la tarjeta de confirmación. "Cancelar" aborta sin guardar.
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import CetiButton from '@shared/components/CetiButton';
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
    <CetiBottomSheet
      visible={visible}
      onClose={onCancel}
      title={processing ? t('movimientos.processing') : t('movimientos.listeningTitle')}
      subtitle={processing ? undefined : t('movimientos.listeningHint')}
      closeOnBackdropPress={false}
    >
      <View style={styles.body}>
        <View
          style={[
            styles.mic,
            { backgroundColor: processing ? colors.materials.highlight : colors.system.red },
          ]}
        >
          {processing ? (
            <ActivityIndicator color={colors.brand.primary} />
          ) : (
            <Ionicons name="mic" size={30} color={colors.text.onBrand} />
          )}
        </View>

        <View
          style={[
            styles.transcriptBox,
            { backgroundColor: colors.materials.highlight, borderColor: colors.materials.border },
          ]}
        >
          <Text
            style={[
              styles.transcript,
              { color: transcript ? colors.text.primary : colors.text.tertiary },
            ]}
          >
            {transcript || t('movimientos.transcriptPlaceholder')}
          </Text>
        </View>

        {!processing && (
          <View style={styles.row}>
            <CetiButton
              label={t('movimientos.cancelar')}
              onPress={onCancel}
              variant="glass"
              size="medium"
              style={{ flex: 1 }}
            />
            <CetiButton
              label={t('movimientos.listo')}
              onPress={onStop}
              variant="primary"
              size="medium"
              style={{ flex: 1 }}
            />
          </View>
        )}
      </View>
    </CetiBottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16, alignItems: 'stretch' },
  mic: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcriptBox: {
    minHeight: 88,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    justifyContent: 'center',
  },
  transcript: { ...Typography.body, lineHeight: 24 },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
});
