/**
 * Catálogo de animaciones de Ceti: única fuente de verdad. Cada ficha es el brief +
 * la configuración de reproducción; las pantallas solo eligen el id.
 *
 * Convención: el id `categoria.nombre` vive en `assets/animations/categoria/nombre.json`
 * (lo verifica catalog.test.ts). Flujo: draft → approved → shipped → deprecated.
 */
import type { AnimationObject } from 'lottie-react-native';

export type AnimationStatus = 'draft' | 'approved' | 'shipped' | 'deprecated';
export type AnimationHaptic = 'success' | 'light' | 'medium';

export interface AnimationSpec {
  source: AnimationObject;
  status: AnimationStatus;
  loop: boolean;
  /** 1 = velocidad de exportación. */
  speed: number;
  /** Háptico que acompaña el inicio de la animación. */
  haptic?: AnimationHaptic;
  /** Componentes/pantallas que la reproducen. Obligatorio si está `shipped`. */
  usedIn: readonly string[];
  /** Qué comunica y cuándo aparece. */
  brief: string;
  /**
   * Con "reducir movimiento" activo: 'still' (por defecto) muestra la pose final quieta;
   * 'once' reproduce una vez sin loop. Solo para entradas cortas sin destellos.
   */
  reducedMotion?: 'still' | 'once';
}

const catalog = {
  'brand.ceti-portal': {
    // Generada por scripts/lottie/ceti.mjs desde la geometría del logo: editar ahí, no el JSON.
    source: require('@/assets/animations/brand/ceti-portal.json'),
    status: 'shipped',
    loop: false,
    speed: 1,
    usedIn: ['WelcomeScreen'],
    reducedMotion: 'once',
    brief: 'Logo animado: se abre el agujero negro, salen las estrellas y Ceti emerge hasta la pose del logo. Splash y bienvenida.',
  },
  'mascot.ceti-idle': {
    // Generada por scripts/lottie/ceti.mjs.
    source: require('@/assets/animations/mascot/ceti-idle.json'),
    status: 'draft',
    loop: true,
    speed: 1,
    usedIn: [],
    brief: 'Ceti en reposo (estado feliz): flota, respira, mece la cola y parpadea. Base de toda pantalla donde aparece.',
  },
  'streak.fire': {
    source: require('@/assets/animations/streak/fire.json'),
    status: 'approved',
    loop: true,
    speed: 1,
    haptic: 'success',
    usedIn: [],
    brief: 'Llama de la racha: se enciende cuando el usuario registra el día y mantiene la racha.',
  },
  'celebration.rocket-launch': {
    source: require('@/assets/animations/celebration/rocket-launch.json'),
    status: 'approved',
    loop: false,
    speed: 1,
    haptic: 'success',
    usedIn: [],
    brief: 'Cohete que despega: celebra un logro grande (meta cumplida, mundo completado).',
  },
  'mascot.piggy-coins-out': {
    source: require('@/assets/animations/mascot/piggy-coins-out.json'),
    status: 'deprecated',
    loop: false,
    speed: 1.15,
    usedIn: [],
    brief: 'Alcancía que suelta monedas. Reemplazada en la bienvenida por brand.ceti-portal.',
  },
  'mascot.piggy-dance': {
    source: require('@/assets/animations/mascot/piggy-dance.json'),
    status: 'draft',
    loop: true,
    speed: 1,
    usedIn: [],
    brief: 'Alcancía bailando: candidata a estado de ánimo positivo de la mascota.',
  },
  'loading.rocket': {
    source: require('@/assets/animations/loading/rocket.json'),
    status: 'draft',
    loop: true,
    speed: 1,
    usedIn: [],
    brief: 'Cohete en vuelo: candidato a carga larga (sincronización, IA).',
  },
} satisfies Record<string, AnimationSpec>;

export type AnimationId = keyof typeof catalog;

export const animations: Record<AnimationId, AnimationSpec> = catalog;

export const animationIds = Object.keys(animations) as AnimationId[];

export function getAnimation(id: AnimationId): AnimationSpec {
  return animations[id];
}

export function categoryOf(id: AnimationId): string {
  return id.split('.')[0];
}
