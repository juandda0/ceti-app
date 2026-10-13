/**
 * Gastos por categoría: barras horizontales ordenadas (una sola serie → un solo
 * color). Tocar una fila la resalta y atenúa las demás; el detalle va arriba.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import type { MovimientoCategoria } from '@features/savings/store/useMovimientosStore';
import type { CategoriaBarra } from './chartData';
import { CATEGORIA_EMOJI, type ChartPalette } from './chartTheme';
import { ChartCard, EmptyHint, GrowBar } from './ChartParts';

export default function CategoryBars({
  data,
  palette,
}: {
  data: CategoriaBarra[];
  palette: ChartPalette;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [sel, setSel] = useState<MovimientoCategoria | null>(null);
  // La selección sobrevive al cambio de periodo solo si la categoría sigue ahí.
  const activo = data.find((d) => d.categoria === sel) ?? null;
  const max = data.length ? data[0].total : 0;
  const nombre = (c: MovimientoCategoria) => t(`movimientos.categorias.${c}`);

  return (
    <ChartCard
      title={t('graficasSeccion.categorias.titulo')}
      subtitle={data.length ? t('graficasSeccion.categorias.ayuda') : undefined}
    >
      {data.length === 0 ? (
        <EmptyHint emoji="🍦" text={t('graficasSeccion.categorias.vacio')} />
      ) : (
        <>
          {activo ? (
            <View style={[styles.detail, { backgroundColor: colors.materials.highlight }]}>
              <Text style={[styles.detailText, { color: colors.text.primary }]}>
                {CATEGORIA_EMOJI[activo.categoria]}{' '}
                {t('graficasSeccion.categorias.detalle', {
                  categoria: nombre(activo.categoria),
                  monto: formatDisplayCopGoals(activo.total),
                  pct: activo.pct,
                })}
              </Text>
            </View>
          ) : null}
          <View style={styles.list}>
            {data.map((d) => {
              const isSel = activo?.categoria === d.categoria;
              return (
                <Pressable
                  key={d.categoria}
                  onPress={() => setSel(isSel ? null : d.categoria)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel }}
                  accessibilityLabel={`${nombre(d.categoria)}: ${formatDisplayCopGoals(d.total)}, ${d.pct}%`}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                  hitSlop={4}
                >
                  <View style={styles.rowTop}>
                    <Text style={styles.emoji}>{CATEGORIA_EMOJI[d.categoria]}</Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.label,
                        { color: colors.text.primary, fontWeight: isSel ? '800' : '600' },
                      ]}
                    >
                      {nombre(d.categoria)}
                    </Text>
                    <Text style={[styles.amount, { color: colors.text.primary }]}>
                      {formatDisplayCopGoals(d.total)}
                    </Text>
                    <Text style={[styles.pct, { color: colors.text.tertiary }]}>{d.pct}%</Text>
                  </View>
                  <GrowBar
                    pct={max > 0 ? (d.total / max) * 100 : 0}
                    color={palette.gasto}
                    trackColor={palette.track}
                    dimmed={activo != null && !isSel}
                  />
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </ChartCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: 14 },
  row: { gap: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emoji: { fontSize: 18, width: 24, textAlign: 'center' },
  label: { flex: 1, fontSize: 15 },
  amount: { fontSize: 15, fontWeight: '800' },
  pct: { fontSize: 13, fontWeight: '600', minWidth: 36, textAlign: 'right' },
  detail: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  detailText: { fontSize: 14, fontWeight: '600' },
});
