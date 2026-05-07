/**
 * Animaciones globales: cortas, easing estable, sin spring en transiciones de layout.
 * Unifica entrada/salida para una sensación sólida y minimalista.
 */
import {
  FadeIn,
  FadeOut,
  FadeInDown,
  FadeInRight,
  FadeOutLeft,
  FadeInUp,
  FadeOutUp,
  ZoomIn,
  Layout,
} from 'react-native-reanimated';

export const motionMs = {
  fade: 165,
  fadeDown: 195,
  horizontal: 185,
  exitHorizontal: 145,
  zoom: 200,
  layout: 175,
  screenEnter: 165,
  screenExit: 115,
  /** Espacio entre ítems en listas escalonadas */
  stagger: 22,
} as const;

export function enterFadeDown(delay = 0) {
  return FadeInDown.duration(motionMs.fadeDown).delay(delay);
}

export function enterFadeDownStagger(baseDelay: number, index = 0) {
  return FadeInDown.duration(motionMs.fadeDown).delay(baseDelay + index * motionMs.stagger);
}

export function enterFade(delay = 0) {
  return FadeIn.duration(motionMs.fade).delay(delay);
}

/** Transiciones de pantalla envueltas (ScreenWrapper) */
export function screenFadeEnter(delay: number) {
  return FadeIn.duration(motionMs.screenEnter).delay(delay);
}

export const screenFadeExit = FadeOut.duration(motionMs.screenExit);

export const motion = {
  screenEnter: screenFadeEnter,
  screenExit: screenFadeExit,

  enterDown: enterFadeDown,
  enterDownStagger: enterFadeDownStagger,
  enterFade,

  stepEnter: FadeInRight.duration(motionMs.horizontal),
  stepExit: FadeOutLeft.duration(motionMs.exitHorizontal),

  enterUp: (delay = 0) => FadeInUp.duration(motionMs.fade).delay(delay),
  exitUp: FadeOutUp.duration(125),

  zoomIn: ZoomIn.duration(motionMs.zoom),
  layout: Layout.duration(motionMs.layout),
} as const;

/** Velocidad sugerida para Lottie (1 = normal). */
export const lottieSpeed = {
  default: 1.35,
  subtle: 1.15,
} as const;
