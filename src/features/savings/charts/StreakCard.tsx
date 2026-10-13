/**
 * Constancia: racha de días seguidos anotando + los 7 días de esta semana.
 * Día con registro = punto lleno con check; sin registro = anillo vacío.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { CetiAnimation } from '@features/animations';
import type { Constancia } from './chartData';
import type { ChartPalette } from './chartTheme';
import { ChartCard } from './ChartParts';

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function StreakCard({ data, palette }: { data: Constancia; palette: ChartPalette }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const encendida = data.racha > 0;
  // Tocar el fueguito lo reinicia desde el fotograma 0.
  const [pasada, setPasada] = useState(0);
  const texto =
    data.racha <= 0
      ? t('graficasSeccion.racha.cero')
      : data.racha === 1
        ? t('graficasSeccion.racha.diaUno')
        : t('graficasSeccion.racha.dias', { dias: data.racha });

  return (
    <ChartCard title={t('graficasSeccion.racha.titulo')}>
      <View style={styles.head}>
        {encendida ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('graficasSeccion.racha.titulo')}
            onPress={() => setPasada((n) => n + 1)}
          >
            <CetiAnimation key={pasada} id="streak.fueguito" size={84} />
          </Pressable>
        ) : null}
        <Text style={[styles.big, { color: colors.text.primary }]}>{Math.max(0, data.racha)}</Text>
        <Text style={[styles.text, { color: colors.text.secondary }]}>{texto}</Text>
      </View>
      <View style={styles.week} accessibilityLabel={t('graficasSeccion.racha.semana')}>
        {DIAS.map((d, i) => {
          const on = data.semana[i] === true;
          const hoy = i === data.hoyIndex;
          return (
            <View key={d} style={styles.day}>
              <View
                style={[
                  styles.dot,
                  on
                    ? { backgroundColor: palette.racha, borderColor: palette.racha }
                    : { backgroundColor: 'transparent', borderColor: colors.materials.borderLight },
                  hoy && !on && { borderColor: palette.racha, borderStyle: 'dashed' },
                ]}
              >
                {on ? <Text style={[styles.check, { color: colors.text.onBrand }]}>✓</Text> : null}
              </View>
              <Text
                style={[
                  styles.dayLabel,
                  {
                    color: hoy ? colors.text.primary : colors.text.tertiary,
                    fontWeight: hoy ? '800' : '600',
                  },
                ]}
              >
                {d}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.caption, { color: colors.text.tertiary }]}>
        {t('graficasSeccion.racha.semana')}
      </Text>
    </ChartCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  big: { fontSize: 44, fontWeight: '900', lineHeight: 50 },
  text: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 4 },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { fontSize: 15, fontWeight: '900' },
  dayLabel: { fontSize: 12 },
  caption: { fontSize: 12 },
});
