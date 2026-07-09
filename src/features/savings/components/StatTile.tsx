/**
 * Primitiva de "stat-tile" compartida (RQ-ES10 P1.4/P2.2): icono + etiqueta +
 * valor. La usan el dashboard de Movimientos (Ahorros/Gastos del mes) y las
 * tarjetas de economía de Metas — misma lectura visual en toda la app.
 */
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';

export default function StatTile({
  icon,
  label,
  value,
  valueColor,
  iconColor,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
  iconColor?: string;
  style?: ViewStyle;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
        style,
      ]}
    >
      <View style={styles.head}>
        <View style={[styles.iconWrap, { backgroundColor: colors.materials.highlight }]}>
          <Ionicons name={icon} size={16} color={iconColor ?? colors.brand.primary} />
        </View>
        <Text style={[styles.label, { color: colors.text.tertiary }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text
        style={[styles.value, { color: valueColor ?? colors.text.primary }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, borderRadius: 20, borderWidth: 1, padding: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Typography.caption2,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    flex: 1,
  },
  value: { ...Typography.title3, fontWeight: '900' },
});
