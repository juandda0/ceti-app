// Anillo suave que "respira" detrás de un botón circular mientras se escucha.
// Solo se monta durante la escucha; al desmontarse se cancela la animación.
// Si el sistema pide reducir movimiento, no se dibuja.
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotionSafe } from '@shared/constants/motion';

export default function ListeningPulse({ size, color }: { size: number; color: string }) {
  const reduceMotion = useReducedMotionSafe();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    t.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) }),
      -1,
      false
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.32 * (1 - t.value),
    transform: [{ scale: 1 + 0.4 * t.value }],
  }));

  if (reduceMotion) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        ringStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute' },
});
