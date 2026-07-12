/**
 * Barra de tope semanal por categoría (RQ-ES11-CA1). El estado (ok/cerca/
 * excedido) se transmite con ICONO + ETIQUETA además del color (WCAG AA: nunca
 * solo color).
 */
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import { estadoTope } from '@features/savings/data/presupuestos';
import type { MovimientoCategoria } from '@features/savings/store/useMovimientosStore';

export default function BudgetBar({
  categoria,
  gastado,
  tope,
}: {
  categoria: MovimientoCategoria;
  gastado: number;
  tope: number;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const estado = estadoTope(gastado, tope);
  const color =
    estado === 'excedido'
      ? colors.system.red
      : estado === 'cerca'
        ? colors.system.orange
        : colors.system.green;
  const icon: keyof typeof Ionicons.glyphMap =
    estado === 'excedido' ? 'alert-circle' : estado === 'cerca' ? 'warning' : 'checkmark-circle';
  const pct = tope > 0 ? Math.min(100, Math.round((gastado / tope) * 100)) : 0;
  const cat = t(`movimientos.categorias.${categoria}`);

  return (
    <View
      style={styles.wrap}
      accessibilityRole="text"
      accessibilityLabel={`${cat}: ${t(`presupuestos.estado.${estado}`)}. ${formatDisplayCopGoals(
        gastado
      )} de ${formatDisplayCopGoals(tope)}`}
    >
      <View style={styles.head}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={[styles.cat, { color: colors.text.primary }]} numberOfLines={1}>
          {cat}
        </Text>
        <Text style={[styles.estado, { color }]}>{t(`presupuestos.estado.${estado}`)}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.materials.base }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.amounts, { color: colors.text.tertiary }]}>
        {formatDisplayCopGoals(gastado)} / {formatDisplayCopGoals(tope)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cat: { ...Typography.subheadline, fontWeight: '700', flex: 1 },
  estado: { ...Typography.caption1, fontWeight: '700' },
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  amounts: { ...Typography.caption2 },
});
