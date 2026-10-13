/**
 * Animaciones globales: cortas, easing estable, sin spring en transiciones de layout.
 * Unifica entrada/salida para una sensación sólida y minimalista.
 */
import { Platform } from 'react-native';
import * as ReanimatedNS from 'react-native-reanimated';
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
  LinearTransition,
  Keyframe,
  Easing,
  ReduceMotion,
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

/** Compat: ahora delega en el preset suave (10 px, ease-out, reduce motion). */
export function enterFadeDown(delay = 0) {
  return enterFadeUp(0, delay);
}

/** Compat: escalonado suave con tope (ver `enterFadeUp`). */
export function enterFadeDownStagger(baseDelay: number, index = 0) {
  return enterFadeUp(index, baseDelay);
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
  enterFadeUp,
  enterSoftFade,
  enterSlideUp,
  enterSoftScale,
  enterFade,

  // Paso de onboarding: entra desde 16 px a la derecha, ease-out suave.
  stepEnter: FadeInRight.duration(260)
    .easing(Easing.out(Easing.cubic))
    .withInitialValues({ opacity: 0, transform: [{ translateX: 16 }] })
    .reduceMotion(ReduceMotion.System),
  stepExit: FadeOutLeft.duration(motionMs.exitHorizontal),

  enterUp: (delay = 0) => FadeInUp.duration(motionMs.fade).delay(delay),
  exitUp: FadeOutUp.duration(125),

  zoomIn: ZoomIn.duration(motionMs.zoom),
  layout: Layout.duration(motionMs.layout),
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Presets "soft" (2026-10): minimalistas, con propósito y que respetan
// "reducir movimiento" del sistema. Úsalos en vez de números sueltos.
// - Feedback de toque: 100–150 ms · cambios de estado: 200–300 ms
// - Entradas: ~300 ms ease-out · salidas ~75% (≈180 ms)
// - Listas: escalonado de 50 ms, tope en 6 ítems; desplazamiento corto (10 px)
// ─────────────────────────────────────────────────────────────────────────────

export const softMs = {
  press: 120,
  state: 240,
  enter: 300,
  exit: 180,
  stagger: 50,
  /** Ítems más allá de este índice usan el mismo retraso (listas largas sin lag). */
  staggerCap: 6,
  /** Retraso inicial máximo: nunca bloquear la interacción. */
  maxDelay: 200,
} as const;

/** Easing de salida suave (desacelera al llegar). */
export const softEasing = Easing.out(Easing.cubic);

// En web, las entradas de reanimated dejan el nodo en `position:absolute` si se
// interrumpen (p. ej. al cambiar de pestaña a mitad): títulos encimados y filas
// invisibles. Allí las entradas se omiten; toques, barras y pulsos sí animan.
const isWebPlatform = Platform.OS === 'web';

/** Desplazamiento vertical corto para entradas (en vez de los 25 px por defecto). */
const ENTER_OFFSET = 10;

/** Retraso escalonado para el índice dado, con tope. */
export function staggerDelay(index = 0, baseDelay = 0): number {
  const capped = Math.min(Math.max(index, 0), softMs.staggerCap);
  return Math.min(baseDelay, softMs.maxDelay) + capped * softMs.stagger;
}

/** Entrada suave: fade + sube 10 px. Para ítems de lista pasa el índice. */
export function enterFadeUp(index = 0, baseDelay = 0) {
  if (isWebPlatform) return undefined;
  return FadeInDown.duration(softMs.enter)
    .delay(staggerDelay(index, baseDelay))
    .easing(softEasing)
    .withInitialValues({ opacity: 0, transform: [{ translateY: ENTER_OFFSET }] })
    .reduceMotion(ReduceMotion.System);
}

/** Entrada solo con opacidad (contenido que no debe moverse). */
export function enterSoftFade(delay = 0) {
  if (isWebPlatform) return undefined;
  return FadeIn.duration(softMs.state)
    .delay(Math.min(delay, softMs.maxDelay))
    .easing(softEasing)
    .reduceMotion(ReduceMotion.System);
}

/** Entrada desde abajo para banners/feedback (sube 12 px). */
export function enterSlideUp(delay = 0) {
  if (isWebPlatform) return undefined;
  return FadeInDown.duration(softMs.state)
    .delay(Math.min(delay, softMs.maxDelay))
    .easing(softEasing)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })
    .reduceMotion(ReduceMotion.System);
}

/** Aparición con escala leve (0.94 → 1), sin rebote. */
export function enterSoftScale(delay = 0) {
  if (isWebPlatform) return undefined;
  return new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.94 }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: softEasing },
  })
    .duration(softMs.enter)
    .delay(Math.min(delay, softMs.maxDelay))
    .reduceMotion(ReduceMotion.System);
}

/** Salida corta (solo nativo: en web las salidas dejan overlays fantasma). */
export const exitSoftFade = FadeOut.duration(softMs.exit).reduceMotion(ReduceMotion.System);

/** Reacomodo de layout cuando cambian ítems de una lista. */
export const softLayout = LinearTransition.duration(softMs.state)
  .easing(softEasing)
  .reduceMotion(ReduceMotion.System);

/** Configs de withTiming reutilizables. */
export const pressInTiming = {
  duration: 100,
  easing: Easing.out(Easing.quad),
  reduceMotion: ReduceMotion.System,
} as const;
export const pressOutTiming = {
  duration: softMs.press,
  easing: Easing.out(Easing.quad),
  reduceMotion: ReduceMotion.System,
} as const;
export const stateTiming = {
  duration: softMs.state,
  easing: softEasing,
  reduceMotion: ReduceMotion.System,
} as const;
/** Barras de progreso: un poco más lenta para que se lea el avance. */
export const progressTiming = {
  duration: 600,
  easing: softEasing,
  reduceMotion: ReduceMotion.System,
} as const;

/** Escala al presionar (botones, tarjetas, opciones). */
export const pressScale = 0.97;

// En web, `exiting` y `layout` de reanimated dejan overlays fantasma / saltos
// (ver ScreenWrapper): allí solo usamos `entering`.
const isWeb = Platform.OS === 'web';
/** `layout` para listas (solo nativo). */
export const listLayout = isWeb ? undefined : softLayout;
/** `exiting` para ítems de lista (solo nativo). */
export const listExit = isWeb ? undefined : exitSoftFade;

/**
 * `useReducedMotion` seguro: el mock de jest de reanimated no lo exporta.
 * Úsalo para NO montar animaciones en bucle cuando el sistema pide menos movimiento.
 */
export const useReducedMotionSafe: () => boolean =
  typeof ReanimatedNS.useReducedMotion === 'function' ? ReanimatedNS.useReducedMotion : () => false;
