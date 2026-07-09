/**
 * Segmented control minimalista (RQ-ES10 P0.1). Reusa el patrón de chips-segmento
 * del ConfirmMovimientoSheet para alternar vistas (p.ej. Historial · Resumen)
 * sin apilar todo en un scroll.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';

export default function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={[styles.track, { backgroundColor: colors.materials.highlight }]}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[styles.segment, active && { backgroundColor: colors.background.primary }]}
            onPress={() => onChange(opt.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
          >
            <Text
              style={[styles.label, { color: active ? colors.text.primary : colors.text.tertiary }]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  label: { ...Typography.subheadline, fontWeight: '700' },
});
