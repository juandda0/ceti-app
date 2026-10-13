/**
 * Sheet de captura por voz (RQ-ES10). Estilo "buscador por voz" (YouTube): vista
 * limpia sobre la superficie oscura del sheet — el texto dictado aparece grande
 * SIN caja tipo-input, con el micrófono abajo. La captura se detiene sola al
 * hacer silencio (continuous:false) y clasifica; tocar el mic la adelanta, la X
 * cancela.
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { enterSoftFade, enterSoftScale } from '@shared/constants/motion';
import ListeningPulse from '@shared/components/motion/ListeningPulse';

export default function VoiceCaptureSheet({
  visible,
  processing,
  transcript,
  initialText,
  onStop,
  onCancel,
  onSubmitText,
  onSwitchToText,
  errorMessage,
  startInWriting = false,
}: {
  visible: boolean;
  processing: boolean;
  transcript: string;
  initialText: string;
  onStop: () => void;
  onCancel: () => void;
  onSubmitText: (text: string) => void;
  onSwitchToText: () => void;
  /** Error al organizar: se muestra encima del texto para corregir y reintentar. */
  errorMessage?: string | null;
  /** Abre directamente el modo escribir (sin micrófono o tras un error). */
  startInWriting?: boolean;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!visible) {
      setWriting(false);
      setText('');
    } else if (initialText || startInWriting) {
      setWriting(true);
      setText(initialText);
    }
  }, [visible, initialText, startInWriting]);

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
            {processing
              ? t('movimientos.processing')
              : writing
                ? t('movimientos.writingTitle')
                : t('movimientos.listeningTitle')}
          </Text>
          {errorMessage && !processing ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: colors.system.red }]}>
              {errorMessage}
            </Text>
          ) : null}
          {writing ? (
            <Animated.View entering={enterSoftFade()} style={styles.writingGroup}>
              <TextInput
                autoFocus
                multiline
                maxLength={300}
                value={text}
                onChangeText={setText}
                editable={!processing}
                accessibilityLabel={t('financialAssistant.requestLabel')}
                placeholder={t('financialAssistant.requestPlaceholder')}
                placeholderTextColor={colors.text.tertiary}
                style={[
                  styles.textInput,
                  { color: colors.text.primary, borderColor: colors.materials.border },
                ]}
              />
              <TouchableOpacity
                disabled={!text.trim() || processing}
                onPress={() => onSubmitText(text.trim())}
                accessibilityRole="button"
                accessibilityLabel={t('financialAssistant.organize')}
                accessibilityState={{ disabled: !text.trim() || processing }}
                style={[
                  styles.organize,
                  { backgroundColor: colors.brand.primary },
                  (!text.trim() || processing) && styles.disabled,
                ]}
              >
                <Text style={[styles.organizeText, { color: colors.text.onBrand }]}>
                  {t('financialAssistant.organize')}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <Animated.Text
              entering={enterSoftFade()}
              style={[
                styles.transcript,
                { color: transcript ? colors.text.primary : colors.text.tertiary },
              ]}
            >
              {transcript || t('movimientos.transcriptPlaceholder')}
            </Animated.Text>
          )}
        </View>

        <View style={styles.micWrap}>
          {processing ? (
            <View style={[styles.mic, { backgroundColor: colors.materials.highlight }]}>
              <ActivityIndicator color={colors.brand.primary} />
            </View>
          ) : !writing ? (
            <Animated.View entering={enterSoftScale()} style={styles.micStack}>
              {/* Anillo suave solo MIENTRAS se escucha. */}
              <ListeningPulse size={72} color={colors.system.red} />
              <TouchableOpacity
                onPress={onStop}
                activeOpacity={0.85}
                style={[styles.mic, { backgroundColor: colors.system.red }]}
                accessibilityRole="button"
                accessibilityLabel={t('movimientos.listo')}
              >
                <Ionicons name="stop" size={30} color={colors.text.onBrand} />
              </TouchableOpacity>
            </Animated.View>
          ) : null}
          {!processing && !writing ? (
            <Text style={[styles.doneLabel, { color: colors.text.secondary }]}>
              {t('movimientos.listo')}
            </Text>
          ) : null}
          {!processing && !writing ? (
            <TouchableOpacity
              onPress={() => {
                onSwitchToText();
                setWriting(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('financialAssistant.writeInstead')}
            >
              <Text style={[styles.writeInstead, { color: colors.brand.primary }]}>
                {t('financialAssistant.writeInstead')}
              </Text>
            </TouchableOpacity>
          ) : null}
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
  micStack: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  writingGroup: { gap: 12 },
  mic: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    ...Typography.body,
    minHeight: 112,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    textAlignVertical: 'top',
  },
  organize: { alignItems: 'center', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18 },
  organizeText: { ...Typography.buttonLarge, fontWeight: '800' },
  writeInstead: { ...Typography.subheadline, fontWeight: '700', paddingVertical: 12 },
  disabled: { opacity: 0.4 },
  error: { ...Typography.subheadline, fontWeight: '700' },
  doneLabel: { ...Typography.subheadline, fontWeight: '700', paddingTop: 6 },
});
