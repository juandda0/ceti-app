/**
 * Diario de bolsillo por voz (RQ-ES10): mic → transcript (navegador) →
 * clasificación server-side → confirmación editable → diario solo-vista-propia.
 * La voz es el ÚNICO camino de registro (D-ES10-03); si la clasificación falla,
 * la tarjeta de confirmación se abre pre-llenada con el transcript.
 */
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { motion } from '@shared/constants/motion';
import { Spacing } from '@shared/constants/theme';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showCetiNotice } from '@shared/store/useCetiOverlayStore';
import ConfirmMovimientoSheet from '@features/savings/components/ConfirmMovimientoSheet';
import MicButton from '@features/savings/components/MicButton';
import VoiceCaptureSheet from '@features/savings/components/VoiceCaptureSheet';
import MovimientoListItem from '@features/savings/components/MovimientoListItem';
import MovimientosCharts from '@features/savings/components/MovimientosCharts';
import { movimientosOrdenados } from '@features/savings/data/movimientosStats';
import { vozService, type ClasificacionMovimiento } from '@features/savings/data/vozService';
import { useVoiceCapture } from '@features/savings/hooks/useVoiceCapture';
import { useMovimientosStore } from '@features/savings/store/useMovimientosStore';

const HISTORIAL_MAX = 30;

function errorCode(e: unknown): string {
  return typeof e === 'object' && e !== null && 'code' in e
    ? String((e as { code: unknown }).code)
    : '';
}

export default function MovimientosScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { goalId } = useLocalSearchParams<{ goalId?: string }>();

  const movimientos = useMovimientosStore((s) => s.movimientos);
  const removeMovimiento = useMovimientosStore((s) => s.removeMovimiento);

  const [processing, setProcessing] = useState(false);
  const [clasificacion, setClasificacion] = useState<ClasificacionMovimiento | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const onTranscript = (texto: string) => {
    setProcessing(true);
    void (async () => {
      try {
        const resultado = await vozService.procesarRegistroVoz(texto);
        setClasificacion(resultado);
        setSheetVisible(true);
      } catch (e) {
        if (errorCode(e).includes('resource-exhausted')) {
          showCetiNotice({
            variant: 'info',
            title: t('movimientos.capTitle'),
            message: t('movimientos.capMsg'),
          });
          return;
        }
        // Clasificador caído/red: la tarjeta editable ES el fallback — se abre
        // pre-llenada con el transcript para corregir a mano (D-ES10-03).
        showCetiNotice({
          variant: 'error',
          title: t('movimientos.errorTitle'),
          message: t('movimientos.errorMsg'),
        });
        setClasificacion({
          tipo: 'gasto',
          monto: 0,
          descripcion: texto.slice(0, 140),
          categoria: 'otros',
          confianza: 0,
        });
        setSheetVisible(true);
      } finally {
        setProcessing(false);
      }
    })();
  };

  const { state, transcript, start, stop, cancel } = useVoiceCapture(onTranscript);
  const historial = movimientosOrdenados(movimientos).slice(0, HISTORIAL_MAX);
  const capturando = state === 'listening' || processing;

  return (
    <>
      <ScreenWrapper style={[styles.root, { backgroundColor: colors.background.base }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 8) + 16 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.pageTitle, { color: colors.text.primary }]}>
            {t('movimientos.pageTitle')}
          </Text>
          <Text style={[styles.pageSubtitle, { color: colors.text.secondary }]}>
            {t('movimientos.pageSubtitle')}
          </Text>

          <Animated.View entering={motion.enterDown(72)} style={styles.micSection}>
            {state === 'unavailable' ? (
              <View
                style={[
                  styles.noticeCard,
                  { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
                ]}
              >
                <Ionicons name="mic-off-outline" size={32} color={colors.text.tertiary} />
                <Text style={[styles.noticeTitle, { color: colors.text.primary }]}>
                  {t('movimientos.unavailableTitle')}
                </Text>
                <Text style={[styles.noticeBody, { color: colors.text.tertiary }]}>
                  {t('movimientos.unavailableBody')}
                </Text>
              </View>
            ) : state === 'denied' ? (
              <View
                style={[
                  styles.noticeCard,
                  { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
                ]}
              >
                <Ionicons name="mic-off-outline" size={32} color={colors.system.red} />
                <Text style={[styles.noticeTitle, { color: colors.text.primary }]}>
                  {t('movimientos.deniedTitle')}
                </Text>
                <Text style={[styles.noticeBody, { color: colors.text.tertiary }]}>
                  {t('movimientos.deniedBody')}
                </Text>
              </View>
            ) : (
              <MicButton state={state} processing={capturando} onStart={start} onStop={stop} />
            )}
          </Animated.View>

          <Animated.View entering={motion.enterDown(104)}>
            <MovimientosCharts movimientos={movimientos} />
          </Animated.View>

          <Animated.View entering={motion.enterDown(136)} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              {t('movimientos.historial')}
            </Text>
            <View
              style={[
                styles.historyBox,
                { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
              ]}
            >
              {historial.length === 0 ? (
                <View style={styles.historyEmpty}>
                  <Text style={[styles.noticeBody, { color: colors.text.tertiary }]}>
                    {t('movimientos.vacio')}
                  </Text>
                </View>
              ) : (
                historial.map((m, i, arr) => (
                  <MovimientoListItem
                    key={m.id}
                    movimiento={m}
                    showDivider={i < arr.length - 1}
                    onDelete={() => removeMovimiento(m.id)}
                  />
                ))
              )}
            </View>
          </Animated.View>
        </ScrollView>
      </ScreenWrapper>

      <VoiceCaptureSheet
        visible={capturando}
        processing={processing}
        transcript={transcript}
        onStop={stop}
        onCancel={cancel}
      />

      <ConfirmMovimientoSheet
        visible={sheetVisible}
        clasificacion={clasificacion}
        preSelectedGoalId={typeof goalId === 'string' ? goalId : undefined}
        onClose={() => setSheetVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.base, paddingBottom: 120, gap: 22 },
  pageTitle: { ...Typography.largeTitle, fontWeight: '900' },
  pageSubtitle: { ...Typography.subheadline, marginTop: 4 },
  micSection: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  noticeCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 10,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
  },
  noticeTitle: { ...Typography.headline, fontWeight: '800', textAlign: 'center' },
  noticeBody: { ...Typography.subheadline, textAlign: 'center' },
  section: { gap: 14 },
  sectionTitle: { ...Typography.title3, fontWeight: '800' },
  historyBox: { borderRadius: 20, paddingHorizontal: 4, paddingVertical: 4, borderWidth: 1 },
  historyEmpty: { paddingVertical: 20, alignItems: 'center' },
});
