/**
 * Botón flotante de voz + orquestación completa (montado en el layout de
 * pestañas, funciona desde cualquier pestaña): tocar → escucha INMEDIATA
 * (recognition.start() síncrono en el onPress, requisito de Safari iOS) →
 * transcript en vivo → "Ceti está organizando…" → resumen editable → confirmar.
 * Sin SpeechRecognition (Firefox, PWA iOS) abre el modo "Escribir".
 */
import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showCetiToast } from '@shared/store/useCetiOverlayStore';
import FinancialAssistantSheet from '@features/savings/components/FinancialAssistantSheet';
import VoiceCaptureSheet from '@features/savings/components/VoiceCaptureSheet';
import { vozService } from '@features/savings/data/vozService';
import {
  buildFinancialContext,
  type FinancialPlan,
} from '@features/savings/assistant/financialPlan';
import { useVoiceCapture, type VoiceCaptureError } from '@features/savings/hooks/useVoiceCapture';
import { useMovimientosStore } from '@features/savings/store/useMovimientosStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useVoiceAssistantStore } from '@features/savings/store/useVoiceAssistantStore';

function isRateLimited(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code.includes('resource-exhausted');
}

export default function FloatingVoiceButton() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  // Dentro de un mundo (micro-teoría y quiz) el botón taparía "Comprobar"/"Siguiente".
  const inWorld = /^\/saga\/./.test(usePathname() ?? '');
  const movimientos = useMovimientosStore((s) => s.movimientos);
  const goals = useSavingsStore((s) => s.goals);
  const operations = useSavingsStore((s) => s.operations);

  const [processing, setProcessing] = useState(false);
  const [financialPlan, setFinancialPlan] = useState<FinancialPlan | null>(null);
  const [assistantVisible, setAssistantVisible] = useState(false);
  const [manualCaptureVisible, setManualCaptureVisible] = useState(false);
  const [capturedText, setCapturedText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const organizeTranscript = (texto: string) => {
    setProcessing(true);
    setErrorMessage(null);
    setCapturedText(texto);
    void (async () => {
      try {
        const context = buildFinancialContext(
          movimientos,
          goals.map((goal) => ({
            id: goal.id,
            title: goal.title,
            iconId: goal.iconId ?? 'target',
            category: goal.category,
            targetAmount: goal.targetAmount,
            createdAt: goal.createdAt,
            updatedAt: goal.updatedAt ?? goal.createdAt,
            ...(goal.deadline === undefined ? {} : { deadline: goal.deadline }),
            ...(goal.deletedAt === undefined ? {} : { deletedAt: goal.deletedAt }),
          })),
          operations
        );
        const plan = await vozService.planificar(texto, context, `voice_${Date.now()}`);
        setFinancialPlan(plan);
        setManualCaptureVisible(false);
        setCapturedText('');
        setAssistantVisible(true);
      } catch (error) {
        // Conservamos lo dicho y abrimos "Escribir" pre-llenado para corregir/reintentar.
        setErrorMessage(
          isRateLimited(error) ? t('movimientos.rateLimited') : t('movimientos.voiceErrorMsg')
        );
        setCapturedText(texto);
        setManualCaptureVisible(true);
      } finally {
        setProcessing(false);
      }
    })();
  };

  const onVoiceError = (error: VoiceCaptureError) => {
    if (error === 'no-speech') {
      showCetiToast({ variant: 'info', title: t('movimientos.noSpeech') });
      return;
    }
    // Sin micrófono / sin red / fallo al iniciar: pasamos a escribir.
    setErrorMessage(
      error === 'denied'
        ? t('movimientos.micDenied')
        : error === 'network'
          ? t('movimientos.networkError')
          : t('movimientos.audioCapture')
    );
    setManualCaptureVisible(true);
  };

  const { state, transcript, start, stop, cancel } = useVoiceCapture(
    organizeTranscript,
    onVoiceError
  );

  const openWriting = () => {
    cancel();
    setErrorMessage(null);
    setManualCaptureVisible(true);
  };

  // Llamado SÍNCRONO dentro del onPress (gesto del usuario requerido por iOS).
  const startCapture = () => {
    if (processing) return;
    setErrorMessage(null);
    setCapturedText('');
    if (state === 'unavailable') {
      setManualCaptureVisible(true);
      return;
    }
    if (state === 'listening') {
      stop();
      return;
    }
    start();
  };

  const listening = state === 'listening';
  const captureVisible = listening || manualCaptureVisible || processing;
  const sheetOpen = captureVisible || assistantVisible;

  useEffect(() => {
    useVoiceAssistantStore.setState({
      voiceState: state,
      processing,
      sheetOpen,
      start: startCapture,
      stop,
      openWriting,
    });
  });

  return (
    <>
      {!sheetOpen && !inWorld ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('financialVoice.open')}
          onPress={startCapture}
          style={[styles.button, { backgroundColor: colors.brand.primary }]}
        >
          <Ionicons name="mic" size={24} color={colors.text.onBrand} />
        </TouchableOpacity>
      ) : null}

      <VoiceCaptureSheet
        visible={captureVisible}
        processing={processing}
        transcript={listening ? transcript : capturedText}
        initialText={manualCaptureVisible ? capturedText : ''}
        errorMessage={errorMessage}
        startInWriting={manualCaptureVisible && !listening}
        onStop={stop}
        onCancel={() => {
          setManualCaptureVisible(false);
          setCapturedText('');
          setErrorMessage(null);
          cancel();
        }}
        onSubmitText={(text) => {
          cancel();
          organizeTranscript(text);
        }}
        onSwitchToText={openWriting}
      />

      <FinancialAssistantSheet
        visible={assistantVisible}
        plan={financialPlan}
        onChange={setFinancialPlan}
        onClose={() => setAssistantVisible(false)}
        onRedictate={() => {
          setAssistantVisible(false);
          startCapture();
        }}
      />
    </>
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
