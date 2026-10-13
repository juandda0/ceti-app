/**
 * Piezas compartidas de Gráficas. Animaciones con Animated de React Native (no
 * layout-animations de reanimated, que en web pueden dejar vistas en opacity 0).
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '@shared/hooks/useThemeColors';

const nativeDriver = Platform.OS !== 'web';

/** Aparece suave (fade + leve subida) al montar; `delay` escalona tarjetas. */
export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: 260,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
    });
    anim.start();
    return () => anim.stop();
  }, [v, delay]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY }] }}>{children}</Animated.View>
  );
}

/** Barra horizontal que crece hasta `pct` (0–100) y se re-anima si cambia. */
export function GrowBar({
  pct,
  color,
  trackColor,
  height = 12,
  dimmed = false,
}: {
  pct: number;
  color: string;
  trackColor: string;
  height?: number;
  dimmed?: boolean;
}) {
  const safe = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(v, {
      toValue: safe,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [v, safe]);
  const width = v.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }]}>
      <Animated.View
        style={{
          width,
          minWidth: safe > 0 ? height : 0,
          height,
          borderRadius: height / 2,
          backgroundColor: color,
          opacity: dimmed ? 0.35 : 1,
        }}
      />
    </View>
  );
}

export function ChartCard({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>{subtitle}</Text>
          ) : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

export function EmptyHint({ emoji, text }: { emoji: string; text: string }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.empty, { backgroundColor: colors.materials.highlight }]}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={[styles.emptyText, { color: colors.text.secondary }]}>{text}</Text>
    </View>
  );
}

export function LegendDot({ color, label }: { color: string; label: string }) {
  const colors = useThemeColors();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: colors.text.secondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 13 },
  track: { width: '100%', overflow: 'hidden' },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14 },
  emptyEmoji: { fontSize: 28 },
  emptyText: { flex: 1, fontSize: 14, lineHeight: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, fontWeight: '600' },
});
