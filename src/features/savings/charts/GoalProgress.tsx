/**
 * Progreso de metas: una barra (medidor) por meta no borrada, con % y lo que falta.
 * Cumplidas en verde con check + texto (nunca solo color).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, type Href } from 'expo-router';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import type { MetaProgreso } from './chartData';
import type { ChartPalette } from './chartTheme';
import { ChartCard, EmptyHint, GrowBar } from './ChartParts';

export default function GoalProgress({
  data,
  palette,
}: {
  data: MetaProgreso[];
  palette: ChartPalette;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();

  const ritmo = (m: MetaProgreso) => {
    if (m.cumplida) return t('graficasSeccion.metas.cumplida');
    if (m.mesesAlRitmo == null || m.mesesAlRitmo <= 0) return t('graficasSeccion.metas.sinRitmo');
    if (m.mesesAlRitmo === 1) return t('graficasSeccion.metas.ritmoUno');
    return t('graficasSeccion.metas.ritmo', { meses: m.mesesAlRitmo });
  };

  return (
    <ChartCard title={t('graficasSeccion.metas.titulo')}>
      {data.length === 0 ? (
        <>
          <EmptyHint emoji="🎯" text={t('graficasSeccion.metas.vacio')} />
          <Pressable
            onPress={() => router.push('/(app)/metas' as Href)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: colors.brand.primary },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.ctaText, { color: colors.text.onBrand }]}>
              {t('graficasSeccion.metas.crear')}
            </Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.list}>
          {data.map((m) => (
            <View key={m.id} style={styles.row}>
              <View style={styles.rowTop}>
                <Text numberOfLines={1} style={[styles.name, { color: colors.text.primary }]}>
                  {m.cumplida ? '✅ ' : ''}
                  {m.title}
                </Text>
                <Text style={[styles.pct, { color: colors.text.primary }]}>{m.pct}%</Text>
              </View>
              <GrowBar
                pct={m.pct}
                height={10}
                color={m.cumplida ? palette.cumplida : palette.meta}
                trackColor={m.cumplida ? palette.cumplidaTrack : palette.metaTrack}
              />
              <View style={styles.rowBottom}>
                <Text style={[styles.meta, { color: colors.text.secondary }]}>
                  {formatDisplayCopGoals(m.actual)} / {formatDisplayCopGoals(m.target)}
                </Text>
                {!m.cumplida ? (
                  <Text style={[styles.meta, { color: colors.text.secondary }]}>
                    {t('graficasSeccion.metas.faltan', {
                      monto: formatDisplayCopGoals(m.restante),
                    })}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.ritmo, { color: colors.text.tertiary }]}>{ritmo(m)}</Text>
            </View>
          ))}
        </View>
      )}
    </ChartCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: 18 },
  row: { gap: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: '700' },
  pct: { fontSize: 15, fontWeight: '800' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  meta: { fontSize: 13, fontWeight: '600' },
  ritmo: { fontSize: 12 },
  cta: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18 },
  ctaText: { fontSize: 14, fontWeight: '800' },
});
