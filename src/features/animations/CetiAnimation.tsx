/**
 * Único reproductor de animaciones de la app: toma loop/velocidad/háptico del catálogo
 * para que todas las pantallas se comporten igual. Con "reducir movimiento" activo
 * muestra la pose final quieta (el primer fotograma de una entrada suele estar vacío),
 * salvo que la ficha pida `reducedMotion: 'once'`: entonces se reproduce una vez.
 * Nativo usa `progress`; web no lo soporta, pero dotLottie en reversa sin autoplay se
 * queda en el último fotograma. Recortar `ip` no sirve: dotLottie lo rompe con precomps.
 */
import { useEffect, type Ref } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { getAnimation, type AnimationHaptic, type AnimationId } from './catalog';

interface CetiAnimationProps {
  id: AnimationId;
  size: number;
  autoPlay?: boolean;
  /** Overrides del catálogo: solo para el Animation Lab o casos justificados. */
  loop?: boolean;
  speed?: number;
  style?: StyleProp<ViewStyle>;
  onFinish?: () => void;
  ref?: Ref<LottieView>;
}

const isWeb = Platform.OS === 'web';

export function playAnimationHaptic(haptic: AnimationHaptic | undefined) {
  // En web expo-haptics no vibra y su promesa puede rechazar.
  if (!haptic || isWeb) return;
  if (haptic === 'success') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } else {
    void Haptics.impactAsync(
      haptic === 'light' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
    );
  }
}

export default function CetiAnimation({
  id,
  size,
  autoPlay = true,
  loop,
  speed,
  style,
  onFinish,
  ref,
}: CetiAnimationProps) {
  const spec = getAnimation(id);
  const reducedMotion = useReducedMotion();
  const still = reducedMotion && spec.reducedMotion !== 'once';
  const shouldPlay = autoPlay && !still;

  useEffect(() => {
    if (shouldPlay) playAnimationHaptic(spec.haptic);
  }, [shouldPlay, spec.haptic]);

  return (
    <LottieView
      ref={ref}
      source={spec.source}
      autoPlay={shouldPlay}
      loop={reducedMotion ? false : (loop ?? spec.loop)}
      speed={speed ?? spec.speed}
      progress={still && !isWeb ? 1 : undefined}
      direction={still && isWeb ? -1 : 1}
      onAnimationFinish={onFinish}
      style={[{ width: size, height: size }, style]}
      webStyle={{ width: size, height: size }}
    />
  );
}
