/**
 * Diario de bolsillo por voz (RQ-ES10): mic → transcript (navegador) →
 * clasificación local → confirmación editable → diario solo-vista-propia.
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
import ConfirmMetaSheet, {
  type MetaPropuesta,
} from '@features/savings/components/ConfirmMetaSheet';
import MicButton from '@features/savings/components/MicButton';
import Segmented from '@features/savings/components/Segmented';
import VoiceCaptureSheet from '@features/savings/components/VoiceCaptureSheet';
import MovimientoListItem from '@features/savings/components/MovimientoListItem';
import MovimientosCharts from '@features/savings/components/MovimientosCharts';
import ConfirmMovimientosListSheet from '@features/savings/components/ConfirmMovimientosListSheet';
import { matchGoal } from '@features/savings/data/matchGoal';
import { movimientosOrdenados } from '@features/savings/data/movimientosStats';
import { vozService, type ClasificacionMovimiento } from '@features/savings/data/vozService';
import { useVoiceCapture } from '@features/savings/hooks/useVoiceCapture';
import { useMovimientosStore } from '@features/savings/store/useMovimientosStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';

const HISTORIAL_MAX = 30;

export default function MovimientosScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { goalId } = useLocalSearchParams<{ goalId?: string }>();

  const movimientos = useMovimientosStore((s) => s.movimientos);
  const removeMovimiento = useMovimientosStore((s) => s.removeMovimiento);
  const goals = useSavingsStore((s) => s.goals);

  const [processing, setProcessing] = useState(false);
  const [clasificacion, setClasificacion] = useState<ClasificacionMovimiento | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [preGoalId, setPreGoalId] = useState<string | undefined>(undefined);
  const [metaPropuesta, setMetaPropuesta] = useState<MetaPropuesta | null>(null);
  const [metaSheetVisible, setMetaSheetVisible] = useState(false);
  const [segment, setSegment] = useState<'historial' | 'resumen'>('historial');
  const [listaItems, setListaItems] = useState<ClasificacionMovimiento[] | null>(null);
  const [listaVisible, setListaVisible] = useState(false);

  const onTranscript = (texto: string) => {
    setProcessing(true);
    void (async () => {
      const rutaGoalId = typeof goalId === 'string' ? goalId : undefined;
      try {
        const items = await vozService.clasificarRegistroLocal(texto);
        // Varios movimientos en una sola frase → confirmación en lote.
        if (items.length > 1) {
          setListaItems(items);
          setListaVisible(true);
          return;
        }
        const single = items[0];
        // Si falta un monto verificable no abrimos ninguna tarjeta.
        if (single.intencion === 'no_entendido') {
          showCetiNotice({
            variant: 'info',
            title: t('movimientos.noEntendiTitle'),
            message: t('movimientos.noEntendiMsg'),
          });
          return;
        }
        // Ramifica por intención detectada por palabra clave (D-ES10-06).
        if (single.intencion === 'crear_meta') {
          setMetaPropuesta({ nombre: single.descripcion, objetivo: single.monto });
          setMetaSheetVisible(true);
          return;
        }
        if (single.intencion === 'abonar_meta') {
          const g = matchGoal(single.descripcion, goals);
          setClasificacion({ ...single, tipo: 'ahorro' });
          setPreGoalId(g?.id ?? rutaGoalId);
        } else {
          setClasificacion(single);
          setPreGoalId(rutaGoalId);
        }
        setSheetVisible(true);
      } catch {
        // Fallback defensivo: la tarjeta editable conserva el registro manual.
        showCetiNotice({
          variant: 'error',
          title: t('movimientos.errorTitle'),
          message: t('movimientos.errorMsg'),
        });
        setClasificacion({
          intencion: 'movimiento',
          tipo: 'gasto',
          monto: 0,
          descripcion: texto.slice(0, 140),
          categoria: 'otros',
          confianza: 0,
          offsetDias: 0,
        });
        setPreGoalId(rutaGoalId);
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
              <Segmented
                options={[
                  { key: 'historial', label: t('movimientos.historial') },
                  { key: 'resumen', label: t('movimientos.resumen') },
                ]}
                value={segment}
                onChange={setSegment}
              />
              {segment === 'resumen' ? (
                <MovimientosCharts movimientos={movimientos} />
              ) : (
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
                      onDelete={() => removeMovimiento(m.id)}
                    />
                  ))}
                </View>
              )}
            </Animated.View>
          )}
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
        preSelectedGoalId={preGoalId}
        onClose={() => setSheetVisible(false)}
      />

      <ConfirmMetaSheet
        visible={metaSheetVisible}
        propuesta={metaPropuesta}
        onClose={() => setMetaSheetVisible(false)}
      />

      <ConfirmMovimientosListSheet
        visible={listaVisible}
        items={listaItems}
        onClose={() => setListaVisible(false)}
      />
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
