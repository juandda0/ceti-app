/**
 * Gastos vs ahorros en el tiempo: columnas agrupadas (2 series, leyenda siempre
 * visible), un solo eje y con marcas redondas, rejilla de líneas finas. Tocar una
 * columna muestra sus valores arriba; por defecto se ve el tramo actual.
 */
import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import { marcasEje, type Columna, type PeriodoGrafica } from './chartData';
import type { ChartPalette } from './chartTheme';
import { ChartCard, EmptyHint, LegendDot } from './ChartParts';

const ALTO = 170;
const PAD_TOP = 8;
const PAD_BOTTOM = 22; // etiquetas del eje x
const EJE_Y = 44; // ancho reservado para las marcas del eje y
const RADIO = 4;

/** Columna con esquinas superiores redondeadas y base recta en la línea 0. */
function barraPath(x: number, w: number, yTop: number, yBase: number): string {
  const h = yBase - yTop;
  const r = Math.min(RADIO, w / 2, h);
  return [
    `M${x},${yBase}`,
    `L${x},${yTop + r}`,
    `Q${x},${yTop} ${x + r},${yTop}`,
    `L${x + w - r},${yTop}`,
    `Q${x + w},${yTop} ${x + w},${yTop + r}`,
    `L${x + w},${yBase}`,
    'Z',
  ].join(' ');
}

function corto(n: number): string {
  if (n >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}M`.replace('.', ',');
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

export default function TimeColumns({
  data,
  periodo,
  palette,
}: {
  data: Columna[];
  periodo: PeriodoGrafica;
  palette: ChartPalette;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [ancho, setAncho] = useState(0);
  const [sel, setSel] = useState<number | null>(null);

  const vacio = data.every((c) => c.gastos <= 0 && c.ahorros <= 0);
  const marcas = useMemo(
    () => marcasEje(Math.max(0, ...data.map((c) => Math.max(c.gastos, c.ahorros)))),
    [data]
  );
  const tope = marcas[marcas.length - 1] || 1;
  const actualIdx = data.findIndex((c) => c.actual);
  const idx = sel != null && sel < data.length ? sel : actualIdx >= 0 ? actualIdx : data.length - 1;
  const col = data[idx];

  const plotW = Math.max(0, ancho - EJE_Y);
  const plotH = ALTO - PAD_TOP - PAD_BOTTOM;
  const slot = data.length ? plotW / data.length : 0;
  const barW = Math.max(4, Math.min(16, (slot - 12) / 2));
  const yDe = (v: number) => PAD_TOP + plotH - (Math.max(0, v) / tope) * plotH;
  const yBase = PAD_TOP + plotH;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== ancho) setAncho(w);
  };

  return (
    <ChartCard
      title={t(`graficasSeccion.tiempo.titulo_${periodo}`)}
      subtitle={vacio ? undefined : t('graficasSeccion.tiempo.ayuda')}
    >
      {vacio ? (
        <EmptyHint emoji="🎙️" text={t('graficasSeccion.tiempo.vacio')} />
      ) : (
        <>
          <View style={styles.legend}>
            <LegendDot color={palette.gasto} label={t('financialCharts.expenses')} />
            <LegendDot color={palette.ahorro} label={t('financialCharts.savings')} />
          </View>
          {col ? (
            <View style={[styles.detail, { backgroundColor: colors.materials.highlight }]}>
              <Text style={[styles.detailText, { color: colors.text.primary }]}>
                {t('graficasSeccion.tiempo.detalle', {
                  label:
                    col.actual && periodo === 'semana'
                      ? t('graficasSeccion.tiempo.hoy')
                      : col.label,
                  gastos: formatDisplayCopGoals(col.gastos),
                  ahorros: formatDisplayCopGoals(col.ahorros),
                })}
              </Text>
            </View>
          ) : null}
          <View testID="graficas-time-chart" style={{ height: ALTO }} onLayout={onLayout}>
            {ancho > 0 ? (
              <>
                <Svg width={ancho} height={ALTO}>
                  {slot > 0 && col ? (
                    <Rect
                      x={EJE_Y + idx * slot + 2}
                      y={PAD_TOP}
                      width={Math.max(0, slot - 4)}
                      height={plotH}
                      rx={8}
                      fill={palette.highlight}
                    />
                  ) : null}
                  {marcas.map((m) => (
                    <Line
                      key={`g${m}`}
                      x1={EJE_Y}
                      x2={ancho}
                      y1={yDe(m)}
                      y2={yDe(m)}
                      stroke={palette.grid}
                      strokeWidth={1}
                    />
                  ))}
                  {marcas.map((m) => (
                    <SvgText
                      key={`t${m}`}
                      x={EJE_Y - 6}
                      y={yDe(m) + 4}
                      fontSize={10}
                      fill={colors.text.tertiary}
                      textAnchor="end"
                    >
                      {m === 0 ? '0' : `$${corto(m)}`}
                    </SvgText>
                  ))}
                  {data.map((c, i) => {
                    const cx = EJE_Y + i * slot + slot / 2;
                    const xG = cx - barW - 1;
                    const xA = cx + 1;
                    return (
                      <ColumnaSvg
                        key={c.key}
                        c={c}
                        xG={xG}
                        xA={xA}
                        barW={barW}
                        yDe={yDe}
                        yBase={yBase}
                        palette={palette}
                        labelX={cx}
                        labelColor={i === idx ? colors.text.primary : colors.text.tertiary}
                        bold={i === idx}
                      />
                    );
                  })}
                </Svg>
                <View style={[StyleSheet.absoluteFill, styles.hitRow, { left: EJE_Y }]}>
                  {data.map((c, i) => (
                    <Pressable
                      key={c.key}
                      style={styles.hit}
                      onPress={() => setSel(i)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: i === idx }}
                      accessibilityLabel={t('graficasSeccion.tiempo.detalle', {
                        label: c.label,
                        gastos: formatDisplayCopGoals(c.gastos),
                        ahorros: formatDisplayCopGoals(c.ahorros),
                      })}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </>
      )}
    </ChartCard>
  );
}

function ColumnaSvg({
  c,
  xG,
  xA,
  barW,
  yDe,
  yBase,
  palette,
  labelX,
  labelColor,
  bold,
}: {
  c: Columna;
  xG: number;
  xA: number;
  barW: number;
  yDe: (v: number) => number;
  yBase: number;
  palette: ChartPalette;
  labelX: number;
  labelColor: string;
  bold: boolean;
}) {
  // Un valor pequeño pero > 0 siempre se ve (mínimo 2px).
  const top = (v: number) => Math.min(yDe(v), yBase - 2);
  return (
    <G>
      {c.gastos > 0 ? (
        <Path d={barraPath(xG, barW, top(c.gastos), yBase)} fill={palette.gasto} />
      ) : null}
      {c.ahorros > 0 ? (
        <Path d={barraPath(xA, barW, top(c.ahorros), yBase)} fill={palette.ahorro} />
      ) : null}
      <SvgText
        x={labelX}
        y={yBase + 16}
        fontSize={11}
        fontWeight={bold ? '800' : '500'}
        fill={labelColor}
        textAnchor="middle"
      >
        {c.label}
      </SvgText>
    </G>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: 16 },
  detail: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  detailText: { fontSize: 14, fontWeight: '600' },
  hitRow: { flexDirection: 'row' },
  hit: { flex: 1 },
});
