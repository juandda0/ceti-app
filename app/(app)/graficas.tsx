import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useMovimientosStore } from '@features/savings/store/useMovimientosStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import Segmented from '@features/savings/components/Segmented';
import {
  constancia,
  construirFlujo,
  gastosPorCategoria,
  insightPeriodo,
  progresoMetas,
  resumenPeriodo,
  serieTemporal,
  type PeriodoGrafica,
} from '@features/savings/charts/chartData';
import { chartPalette } from '@features/savings/charts/chartTheme';
import { EmptyHint, FadeIn } from '@features/savings/charts/ChartParts';
import SummaryTiles from '@features/savings/charts/SummaryTiles';
import CategoryBars from '@features/savings/charts/CategoryBars';
import TimeColumns from '@features/savings/charts/TimeColumns';
import GoalProgress from '@features/savings/charts/GoalProgress';
import StreakCard from '@features/savings/charts/StreakCard';

export default function GraficasScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const movimientos = useMovimientosStore((state) => state.movimientos);
  const goals = useSavingsStore((state) => state.goals);
  const operations = useSavingsStore((state) => state.operations);
  const [periodo, setPeriodo] = useState<PeriodoGrafica>('semana');

  const palette = useMemo(() => chartPalette(colors), [colors]);
  const flujo = useMemo(() => construirFlujo(movimientos, operations), [movimientos, operations]);
  const vista = useMemo(() => {
    const now = Date.now();
    const resumen = resumenPeriodo(flujo, periodo, now);
    return {
      resumen,
      insight: insightPeriodo(resumen),
      categorias: gastosPorCategoria(movimientos, periodo, now),
      serie: serieTemporal(flujo, periodo, now),
    };
  }, [flujo, movimientos, periodo]);
  const metas = useMemo(() => progresoMetas(goals, operations), [goals, operations]);
  const racha = useMemo(() => constancia(movimientos, operations), [movimientos, operations]);

  const sinNada = flujo.length === 0;
  const periodos = useMemo(
    () =>
      (['semana', 'mes', 'todo'] as const).map((key) => ({
        key,
        label: t(`graficasSeccion.periodo.${key}`),
      })),
    [t]
  );

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            {t('financialCharts.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            {t('financialCharts.subtitle')}
          </Text>
        </View>

        {sinNada ? (
          <FadeIn>
            <View
              style={[
                styles.hero,
                { backgroundColor: colors.fill.brandSubtle, borderColor: colors.materials.border },
              ]}
            >
              <View style={[styles.heroIcon, { backgroundColor: colors.brand.primary + '22' }]}>
                <Ionicons name="bar-chart" size={28} color={colors.brand.primary} />
              </View>
              <Text style={[styles.heroTitle, { color: colors.text.primary }]}>
                {t('graficasSeccion.vacioTitulo')}
              </Text>
              <Text style={[styles.heroText, { color: colors.text.secondary }]}>
                {t('graficasSeccion.vacioTexto')}
              </Text>
            </View>
          </FadeIn>
        ) : (
          <>
            <Segmented options={periodos} value={periodo} onChange={setPeriodo} />
            {/* key={periodo}: al cambiar de periodo las tarjetas re-entran y se
                reinicia la selección de cada gráfica. */}
            <View key={periodo} style={styles.sections}>
              <FadeIn>
                <SummaryTiles
                  resumen={vista.resumen}
                  insight={vista.insight}
                  periodo={periodo}
                  palette={palette}
                />
              </FadeIn>
              <FadeIn delay={60}>
                <TimeColumns data={vista.serie} periodo={periodo} palette={palette} />
              </FadeIn>
              <FadeIn delay={120}>
                <CategoryBars data={vista.categorias} palette={palette} />
              </FadeIn>
            </View>
          </>
        )}

        <FadeIn delay={180}>
          <GoalProgress data={metas} palette={palette} />
        </FadeIn>
        <FadeIn delay={240}>
          {sinNada ? (
            <EmptyHint emoji="🔥" text={t('graficasSeccion.racha.cero')} />
          ) : (
            <StreakCard data={racha} palette={palette} />
          )}
        </FadeIn>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 130, gap: 16 },
  header: { gap: 4 },
  title: { fontSize: 34, fontWeight: '900' },
  subtitle: { fontSize: 15 },
  sections: { gap: 16 },
  hero: { borderWidth: 1, borderRadius: 20, padding: 20, gap: 8, alignItems: 'flex-start' },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 20, fontWeight: '900' },
  heroText: { fontSize: 15, lineHeight: 21 },
});
