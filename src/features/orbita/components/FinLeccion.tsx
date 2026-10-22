/**
 * Cierre de una lección o del jefe: Ceti celebra, se ven el XP, los Cetis, la
 * racha y la meta del día. Cada recompensa dice qué lograste, no solo "+10".
 */
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CetiAnimation } from '@features/animations';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import AnimatedProgressFill from '@shared/components/motion/AnimatedProgressFill';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import { BorderRadius, Spacing } from '@shared/constants/theme';
import { enterFadeUp, enterSoftFade, enterSoftScale } from '@shared/constants/motion';
import type { RecompensaPractica } from '@features/orbita/domain/orbita';
import { hashStr } from '@shared/lib/quizUtils';
import { MonedaCeti } from '@features/orbita/components/iconos';
import type { ReactNode } from 'react';

const FRASES_PERFECTA = ['orbita.fin.frasePerfecta1', 'orbita.fin.frasePerfecta2'] as const;
const FRASES_NORMAL = ['orbita.fin.frase1', 'orbita.fin.frase2', 'orbita.fin.frase3'] as const;

export default function FinLeccion({
  recompensa,
  modo,
  titulo,
  color,
  aciertos,
  total,
  conquistado,
  onContinuar,
}: {
  recompensa: RecompensaPractica;
  modo: 'leccion' | 'jefe' | 'primer_vuelo';
  titulo: string;
  color: string;
  /** Acertadas a la primera. */
  aciertos: number;
  total: number;
  /** El jefe se ganó y el planeta quedó conquistado. */
  conquistado?: boolean;
  onContinuar: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const perfecta = aciertos === total;
  const r = recompensa;

  const encabezado = conquistado
    ? t('orbita.fin.conquistado')
    : modo === 'primer_vuelo'
      ? t('orbita.fin.primerVuelo')
      : perfecta
      ? t('orbita.fin.perfecta')
      : t('orbita.fin.completa');
  const frases = perfecta ? FRASES_PERFECTA : FRASES_NORMAL;
  const frase = conquistado
    ? t('orbita.fin.fraseConquista', { mundo: titulo })
    : modo === 'primer_vuelo'
      ? t('orbita.fin.frasePrimerVuelo')
    : t(frases[hashStr(`${titulo}:${r.leccionesHoy}:${r.xp}`) % frases.length]);

  const notas: { icono: keyof typeof Ionicons.glyphMap; color: string; texto: string }[] = [];
  if (r.reparada) {
    notas.push({ icono: 'build', color: colors.system.teal, texto: t('orbita.fin.reparada', { racha: r.racha }) });
  }
  if (r.hito) {
    notas.push({
      icono: 'trophy',
      color: colors.gold.primary,
      texto: t('orbita.fin.hito', { dias: r.hito, cetis: r.cetisHito }),
    });
  }
  if (r.metaCumplida) {
    notas.push({ icono: 'flag', color: colors.brand.primary, texto: t('orbita.fin.meta', { cetis: r.cetisMeta }) });
  }
  if (r.escudoRegalado) {
    notas.push({ icono: 'shield', color: colors.system.teal, texto: t('orbita.fin.escudoRegalo') });
  }
  if (r.rendimientoReducido) {
    notas.push({ icono: 'moon', color: colors.text.tertiary, texto: t('orbita.fin.rendimiento') });
  }

  const metaPct = Math.min(100, (r.leccionesHoy / r.metaLecciones) * 100);
  const cetisTotal = r.cetis + r.cetisHito + r.cetisMeta;

  return (
    <ScreenWrapper style={{ flex: 1, backgroundColor: colors.background.base }}>
      <ScrollView
        contentContainerStyle={[
          st.wrap,
          { paddingTop: Math.max(insets.top, 20) + 16, paddingBottom: Math.max(insets.bottom, 24) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={enterSoftFade()} style={st.center}>
          <CetiAnimation
            id={modo === 'jefe' ? 'celebration.rocket-launch' : 'mascot.ceti-portal-reposo'}
            size={180}
          />
          <Text style={[st.title, { color: colors.text.primary }]} accessibilityRole="header">
            {encabezado}
          </Text>
          <Text style={[st.subtitle, { color: color }]}>{titulo}</Text>
          <View style={[st.burbuja, { backgroundColor: colors.background.elevated }]}>
            <Text style={[st.burbujaTexto, { color: colors.text.primary }]}>{frase}</Text>
          </View>
        </Animated.View>

        <Animated.View entering={enterSoftScale(120)} style={st.chips}>
          <Chip
            icono={<Ionicons name="flash" size={16} color={colors.system.purple} />}
            texto={t('orbita.fin.xp', { xp: r.xp })}
          />
          <Chip icono={<MonedaCeti size={17} />} texto={t('orbita.fin.cetis', { cetis: cetisTotal })} />
          <Chip
            icono={<Ionicons name="flame" size={16} color={colors.brand.primary} />}
            texto={t('orbita.fin.racha', { count: r.racha })}
          />
        </Animated.View>

        <Animated.View
          entering={enterFadeUp(2, 40)}
          style={[st.meta, { backgroundColor: colors.background.elevated, borderColor: colors.materials.border }]}
        >
          <View style={st.metaFila}>
            <Text style={[st.metaTitulo, { color: colors.text.primary }]}>
              {r.leccionesHoy >= r.metaLecciones ? t('orbita.fin.metaHecha') : t('orbita.fin.metaDia')}
            </Text>
            <Text style={[st.metaNum, { color: colors.text.secondary }]}>
              {Math.min(r.leccionesHoy, r.metaLecciones)}/{r.metaLecciones}
            </Text>
          </View>
          <View style={[st.track, { backgroundColor: colors.materials.highlight }]}>
            <AnimatedProgressFill pct={metaPct} duration={600} style={[st.fill, { backgroundColor: colors.brand.primary }]} />
          </View>
          <Text style={[st.precision, { color: colors.text.tertiary }]}>
            {t('orbita.fin.aciertos', { aciertos, total })}
          </Text>
        </Animated.View>

        {notas.length > 0 && (
          <Animated.View entering={enterFadeUp(3, 40)} style={st.notas}>
            {notas.map((n, i) => (
              <View key={i} style={[st.nota, { backgroundColor: colors.background.elevated }]}>
                <Ionicons name={n.icono} size={18} color={n.color} />
                <Text style={[st.notaTexto, { color: colors.text.primary }]}>{n.texto}</Text>
              </View>
            ))}
          </Animated.View>
        )}

        <Animated.View entering={enterFadeUp(4, 40)} style={st.acciones}>
          <TouchableOpacity
            onPress={onContinuar}
            activeOpacity={0.85}
            style={[st.btn, { backgroundColor: colors.brand.primary }]}
            accessibilityRole="button"
          >
            <Text style={[st.btnTexto, { color: colors.text.onBrand }]}>{t('orbita.fin.continuar')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </ScreenWrapper>
  );
}

function Chip({ icono, texto }: { icono: ReactNode; texto: string }) {
  const colors = useThemeColors();
  return (
    <View style={[st.chip, { backgroundColor: colors.background.elevated, borderColor: colors.materials.border }]}>
      {icono}
      <Text style={[st.chipTexto, { color: colors.text.primary }]}>{texto}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: Spacing.base, gap: 18, maxWidth: 560, width: '100%', alignSelf: 'center' },
  center: { alignItems: 'center', gap: 8 },
  title: { ...Typography.title1, fontWeight: '900', textAlign: 'center' },
  subtitle: { ...Typography.subheadline, fontWeight: '800', textAlign: 'center' },
  burbuja: { borderRadius: 18, borderBottomLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 10, marginTop: 4 },
  burbujaTexto: { ...Typography.subheadline, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipTexto: { fontSize: 15, fontWeight: '900' },
  meta: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.base, gap: 8 },
  metaFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaTitulo: { ...Typography.headline, fontWeight: '800' },
  metaNum: { ...Typography.subheadline, fontWeight: '800' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  precision: { ...Typography.footnote },
  notas: { gap: 8 },
  nota: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12 },
  notaTexto: { ...Typography.subheadline, flex: 1 },
  acciones: { marginTop: 'auto' },
  btn: { height: 54, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  btnTexto: { ...Typography.headline, fontWeight: '900' },
});
