// Relleno de barra de progreso que anima su ancho hasta el valor (0–100).
// Animación suave (ease-out ~600 ms) y respeta "reducir movimiento".
import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { progressTiming, softMs } from '@shared/constants/motion';

interface AnimatedProgressFillProps {
  /** Porcentaje 0–100. */
  pct: number;
  style?: StyleProp<ViewStyle>;
  /** Retraso antes de llenar (se limita a softMs.maxDelay). */
  delay?: number;
  /** Duración del llenado (por defecto ~600 ms). */
  duration?: number;
  testID?: string;
}

export default function AnimatedProgressFill({
  pct,
  style,
  delay = 0,
  duration = progressTiming.duration,
  testID,
}: AnimatedProgressFillProps) {
  const target = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(
      Math.min(delay, softMs.maxDelay),
      withTiming(target, { ...progressTiming, duration })
    );
  }, [target, delay, duration, width]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return <Animated.View testID={testID} style={[style, animatedStyle]} />;
}
