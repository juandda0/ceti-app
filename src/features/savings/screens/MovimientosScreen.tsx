/**
 * Diario de bolsillo por voz (RQ-ES10): mic → transcript (navegador) →
 * clasificación local → confirmación editable → diario solo-vista-propia.
 * La voz es el ÚNICO camino de registro (D-ES10-03); si la clasificación falla,
 * la tarjeta de confirmación se abre pre-llenada con el transcript.
 */
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { motion } from '@shared/constants/motion';
import { Spacing } from '@shared/constants/theme';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import MicButton from '@features/savings/components/MicButton';
import MovimientoListItem from '@features/savings/components/MovimientoListItem';
import { movimientosOrdenados } from '@features/savings/data/movimientosStats';
import { useMovimientosStore } from '@features/savings/store/useMovimientosStore';
import { useVoiceAssistantStore } from '@features/savings/store/useVoiceAssistantStore';

const HISTORIAL_MAX = 30;

export default function MovimientosScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const movimientos = useMovimientosStore((s) => s.movimientos);
  const deleteExpense = useMovimientosStore((s) => s.deleteExpense);
  // La captura/organización vive en FloatingVoiceButton (layout): un solo flujo
  // compartido; aquí solo disparamos start/stop dentro del onPress (gesto iOS).
  const state = useVoiceAssistantStore((s) => s.voiceState);
  const processing = useVoiceAssistantStore((s) => s.processing);
  const start = useVoiceAssistantStore((s) => s.start);
  const stop = useVoiceAssistantStore((s) => s.stop);
  const openWriting = useVoiceAssistantStore((s) => s.openWriting);
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
                <TouchableOpacity
                  onPress={() => openWriting()}
                  accessibilityRole="button"
                  accessibilityLabel={t('financialAssistant.writeInstead')}
                >
                  <Text style={[styles.writeFallback, { color: colors.brand.primary }]}>
                    {t('financialAssistant.writeInstead')}
                  </Text>
                </TouchableOpacity>
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
                <TouchableOpacity
                  onPress={() => start()}
                  accessibilityRole="button"
                  accessibilityLabel={t('movimientos.retryMic')}
                >
                  <Text style={[styles.writeFallback, { color: colors.brand.primary }]}>
                    {t('movimientos.retryMic')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => openWriting()}
                  accessibilityRole="button"
                  accessibilityLabel={t('financialAssistant.writeInstead')}
                >
                  <Text style={[styles.writeFallback, { color: colors.brand.primary }]}>
                    {t('financialAssistant.writeInstead')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <MicButton
                state={state}
                processing={capturando}
                onStart={() => start()}
                onStop={() => stop()}
              />
            )}
          </Animated.View>

          {movimientos.length === 0 ? (
            <Animated.View
              entering={motion.enterDown(104)}
              style={[
                styles.emptyCard,
                { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
              ]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={34} color={colors.brand.primary} />
              <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
                {t('movimientos.vacio')}
              </Text>
              <Text style={[styles.emptyExample, { color: colors.text.tertiary }]}>
                {t('movimientos.vacioEjemplo')}
              </Text>
            </Animated.View>
          ) : (
            <Animated.View entering={motion.enterDown(104)} style={styles.section}>
              <View
                style={[
                  styles.historyBox,
                  {
                    backgroundColor: colors.materials.base,
                    borderColor: colors.materials.border,
                  },
                ]}
              >
                {historial.map((m, i, arr) => (
                  <MovimientoListItem
                    key={m.id}
                    movimiento={m}
                    showDivider={i < arr.length - 1}
                    onDelete={() => void deleteExpense(m.id)}
                  />
                ))}
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </ScreenWrapper>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.base, paddingBottom: 120, gap: 22 },
  pageTitle: { ...Typography.largeTitle, fontWeight: '900' },
  pageSubtitle: { ...Typography.subheadline, marginTop: 4 },
  // El mic es la acción primaria y única: protagoniza con aire (P0.1).
  micSection: { alignItems: 'center', gap: 14, paddingVertical: 24 },
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
  writeFallback: { ...Typography.subheadline, fontWeight: '800', paddingVertical: 8 },
  section: { gap: 12 },
  historyBox: { borderRadius: 20, paddingHorizontal: 4, paddingVertical: 4, borderWidth: 1 },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyTitle: { ...Typography.headline, fontWeight: '800', textAlign: 'center' },
  emptyExample: { ...Typography.subheadline, textAlign: 'center', fontStyle: 'italic' },
});
