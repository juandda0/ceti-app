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
   * Excepción al tope de peso del catálogo (150 KB), solo con motivo en el `brief`: p. ej. una entrada de tipo C
   * hecha con poses dibujadas, que no se puede aligerar más sin perder el dibujo.
   */
  pesoMaxKb?: number;
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
    status: 'deprecated',
    loop: false,
    speed: 1,
    usedIn: [],
    reducedMotion: 'once',
    brief: 'Logo animado: se abre el agujero negro, salen las estrellas y Ceti emerge hasta la pose del logo. Reemplazada en la bienvenida por mascot.ceti-portal-entrada/-reposo.',
  },
  // Tipo C (entrada + reposo): scripts/lottie/ceti-personaje.mjs genera assets/brand/ceti/lottie/ceti-portal.json
  // y scripts/lottie/partir-tramos.mjs lo parte en estos dos archivos. Se reproducen con <CetiEntradaReposo>.
  'mascot.ceti-portal-entrada': {
    source: require('@/assets/animations/mascot/ceti-portal-entrada.json'),
    status: 'shipped',
    loop: false,
    speed: 1,
    haptic: 'success',
    usedIn: ['WelcomeScreen'],
    // El salto es un dibujo de perfil que se curva con claves de forma cada 4 fotogramas: no cabe en 150 KB sin
    // perder fluidez.
    pesoMaxKb: 230,
    brief: 'Ceti sale disparada del portal, la fuerza la hace dar una voltereta hacia atrás curvando el cuerpo, cae de cabeza al portal y vuelve a asomar feliz. 2,5 s.',
  },
  'mascot.ceti-portal-reposo': {
    source: require('@/assets/animations/mascot/ceti-portal-reposo.json'),
    status: 'shipped',
    loop: true,
    speed: 1,
    usedIn: ['WelcomeScreen'],
    brief: 'Ceti asomada en el portal: flota, parpadea y las estrellas titilan. Empalma con el final de la entrada.',
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
  'streak.fueguito': {
    source: require('@/assets/animations/streak/fueguito.json'),
    status: 'shipped',
    loop: true,
    speed: 1,
    haptic: 'success',
    usedIn: ['StreakCard'],
    brief:
      'Fueguito de racha: se llena de naranja, tiembla y explota al completarse; luego arde con brasas.',
  },
  'lives.corazon': {
    // Generada por scripts/lottie/corazon.mjs (espejo del fueguito): editar ahí, no el JSON.
    source: require('@/assets/animations/lives/corazon.json'),
    status: 'shipped',
    loop: false,
    speed: 1,
    haptic: 'medium',
    usedIn: ['WorldQuizScreen'],
    brief:
      'Vida perdida (en los corazones de la cabecera del quiz): late, se vacía temblando, se raja y estalla; queda partido en dos, gris, goteando.',
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
  'mascot.ceti-triste': {
    // Tipo B de scripts/lottie/ceti-personaje.mjs (assets/brand/ceti/lottie/ceti-triste.json): editar ahí.
    source: require('@/assets/animations/mascot/ceti-triste.json'),
    status: 'shipped',
    loop: false,
    speed: 1,
    usedIn: ['QuizSinVidas'],
    brief:
      'Ceti triste: suspira, se desinfla, baja las aletas y suelta una lágrima; termina quieta en la pose triste. Una sola vez.',
  },
  'mascot.ceti-vuelo-reposo': {
    // assets/brand/ceti/lottie/ceti-reposo.json sin las capas sombra-piso (vuela, sin suelo) ni surcos
    // (en Tu Galaxia va pequeña junto a los planetas, que son planos: con los surcos se veía más detallada).
    source: require('@/assets/animations/mascot/ceti-vuelo-reposo.json'),
    status: 'approved',
    loop: true,
    speed: 1,
    usedIn: ['CetiViajera'],
    brief: 'Ceti de frente flotando en el espacio, entre salto y salto por Tu Galaxia.',
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
  // Planetas de la familia de mundos (tipo A, loop). Generados por scripts/marca/mundos/<planeta>.py +
  // scripts/lottie/mundo-planeta.mjs (fuente en assets/brand/mundos/): editar ahí, no el JSON.
  'mundos.naranja': {
    source: require('@/assets/animations/mundos/naranja.json'),
    status: 'shipped',
    loop: true,
    speed: 1,
    usedIn: ['WorldsScreen', 'WorldLaunch'],
    brief: 'Planeta naranja con anillo de monedas que gira; el planeta flota. Mundo 1 por defecto.',
  },
  'mundos.lila': {
    source: require('@/assets/animations/mundos/lila.json'),
    status: 'shipped',
    loop: true,
    speed: 1,
    usedIn: ['WorldsScreen', 'WorldLaunch'],
    brief: 'Planeta lila con una luna-moneda que da la vuelta (8 s). Mundo 2 por defecto.',
  },
  'mundos.menta': {
    source: require('@/assets/animations/mundos/menta.json'),
    status: 'shipped',
    loop: true,
    speed: 1,
    usedIn: ['WorldsScreen', 'WorldLaunch'],
    brief: 'Planeta menta con un anillo liso y una cadena de monedas que gira. Mundo 3 por defecto.',
  },
  'mundos.morado': {
    source: require('@/assets/animations/mundos/morado.json'),
    status: 'shipped',
    loop: true,
    speed: 1,
    usedIn: ['WorldsScreen', 'WorldLaunch'],
    brief: 'Planeta morado con pepitas de oro que se mecen. Mundo 4 por defecto.',
  },
  'mundos.azul': {
    source: require('@/assets/animations/mundos/azul.json'),
    status: 'shipped',
    loop: true,
    speed: 1,
    usedIn: ['WorldsScreen', 'WorldLaunch'],
    brief: 'Planeta azul con anillo de oro y gemas que lo recorren (8 s). Mundo 5 por defecto.',
  },
  'mundos.turquesa': {
    source: require('@/assets/animations/mundos/turquesa.json'),
    status: 'shipped',
    loop: true,
    speed: 1,
    usedIn: ['WorldsScreen', 'WorldLaunch'],
    brief: 'Planeta turquesa con oro derretido que chorrea. Reserva para mundos del profesor.',
  },
  'mundos.rosado': {
    source: require('@/assets/animations/mundos/rosado.json'),
    status: 'shipped',
    loop: true,
    speed: 1,
    usedIn: ['WorldsScreen', 'WorldLaunch'],
    brief: 'Planeta rosado con un racimo de cristales que se mece. Reserva para mundos del profesor.',
  },
  'mundos.coral': {
    source: require('@/assets/animations/mundos/coral.json'),
    status: 'shipped',
    loop: true,
    speed: 1,
    usedIn: ['WorldsScreen', 'WorldLaunch'],
    brief: 'Planeta coral con un desfile de monedas. Reserva para mundos del profesor.',
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
