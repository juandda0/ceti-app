import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

/**
 * Respeta “Reducir movimiento” del sistema para animaciones y Lottie.
 */
export function useReduceMotionShared(): {
  reduceMotion: import('react-native-reanimated').SharedValue<boolean>;
} {
  const reduceMotion = useSharedValue(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) reduceMotion.value = v;
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      reduceMotion.value = v;
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return { reduceMotion };
}
