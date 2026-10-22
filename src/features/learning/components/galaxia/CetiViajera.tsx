/**
 * Ceti viajera: aparece un momento junto al planeta activo de Tu Galaxia, en un lugar fijo, al entrar a
 * la pantalla y en cada cambio de mundo (el cambio es instantáneo). Llega volando: un trazo amarillo y
 * naranja entra desde el lado del que viene, ella sale de él frenando, se
 * relaja de perfil y mira al frente; enseguida abre un portal espacial bajo ella, se mete y el portal
 * se cierra (el mismo portal de la bienvenida, mascot.ceti-portal-entrada). Boceto en el artifact
 * "Mundos en movimiento".
 *
 * Piezas: el reposo de frente es el Lottie validado (`mascot.ceti-vuelo-reposo`); las poses de vuelo son
 * SVG vectorizados de assets/brand/bocetos/ceti-06-poses-vuelo.png (scripts/marca/vectorizar, configs
 * `ceti-<pose>.json`). No toca: va encima con pointerEvents="none".
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { CetiAnimation } from '@features/animations';
import TresCuartos from '@/assets/images/ceti-vuelo/tres-cuartos.svg';
import Perfil from '@/assets/images/ceti-vuelo/perfil.svg';
import Disparada from '@/assets/images/ceti-vuelo/disparada.svg';
import Frenando from '@/assets/images/ceti-vuelo/frenando.svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Pose = 'frente' | 'tres-cuartos' | 'perfil' | 'disparada' | 'frenando';

// Cada pose con su tamaño en px de la hoja; la ballena de frente mide 161 px de ancho en esa hoja.
const POSES = {
  'tres-cuartos': { Svg: TresCuartos, w: 211, h: 239 },
  perfil: { Svg: Perfil, w: 237, h: 180 },
  disparada: { Svg: Disparada, w: 252, h: 156 },
  frenando: { Svg: Frenando, w: 175, h: 205 },
} as const;
const ANCHO_FRENTE_HOJA = 161;

// El Lottie de frente mide 640 × 770 y el centro visual de Ceti está al 50 % de ancho y 61 % de alto.
const ALTO_LOTTIE = 770 / 640;
const CENTRO_Y = 0.61;
// el portal se abre bajo la cola: su centro, en fracciones del lado del Lottie bajo el centro de Ceti
const PORTAL_Y = 0.33;

const NARANJA = '#FB6711';
const AMARILLO = '#F7C95F';
const CREMA = '#FFF3D6';
const ESTRELLA = 'M0 -10 Q0 0 10 0 Q0 0 0 10 Q0 0 -10 0 Q0 0 0 -10 Z';

// Portal espacial (como el de mascot.ceti-portal-entrada): elipse oscura achatada y girada, con estrellitas.
const PORTAL_BORDE = '#1E1A18';
const PORTAL_FONDO = '#2A2320';
const PORTAL_GIRO = -6;
const PORTAL_ALTO = 92 / 300; // proporción alto/ancho del portal original
// estrellitas y puntos dentro del portal, en fracciones del radio (x, y, tamaño)
const PORTAL_CHISPAS: readonly [number, number, number][] = [
  [-0.5, -0.15, 1],
  [0.4, -0.3, 0.8],
  [-0.2, 0.32, 0.6],
  [0.62, 0.2, 0.55],
  [0.1, -0.4, 0.5],
  [-0.72, 0.1, 0.5],
];
const PORTAL_PUNTOS: readonly [number, number][] = [
  [-0.33, 0.22],
  [0.2, -0.1],
  [0.5, -0.07],
  [-0.57, -0.25],
  [0.03, 0.43],
  [0.8, -0.35],
  [-0.83, -0.42],
];

const N_ESTRELLAS = 8;
// Las partículas frenan como si perdieran 7 % de velocidad por fotograma a 60 fps.
const FRENO = -Math.log(0.93) * 60;

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t0: number;
  dur: number;
  tam: number;
  giro: number;
}
const VACIA: Particula = { x: 0, y: 0, vx: 0, vy: 0, t0: -1e9, dur: 1, tam: 0, giro: 0 };

interface Trazo {
  ax: number;
  ay: number;
  kx: number;
  ky: number;
  bx: number;
  by: number;
  ancho: number;
}

const azar = (a: number, b: number) => a + Math.random() * (b - a);
const CANCELADO = new Error('cancelado');

/** Estrellita de 4 puntas que crece rápido y se apaga girando. */
function Estrellita({
  i,
  lista,
  reloj,
  color,
}: {
  i: number;
  lista: SharedValue<Particula[]>;
  reloj: SharedValue<number>;
  color: string;
}) {
  const estilo = useAnimatedStyle(() => {
    const p = lista.value[i];
    const edad = (reloj.value - p.t0) / 1000;
    const u = (edad * 1000) / p.dur;
    if (!p || u < 0 || u >= 1) return { opacity: 0, transform: [{ scale: 0 }] };
    const avance = (1 - Math.exp(-FRENO * edad)) / FRENO;
    const k = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8;
    return {
      opacity: 1,
      transform: [
        { translateX: p.x + p.vx * avance - 10 },
        { translateY: p.y + p.vy * avance - 10 },
        { rotate: `${p.giro + edad * 4.5}rad` },
        { scale: (p.tam / 10) * k },
      ],
    };
  });
  return (
    <Animated.View style={[estilos.particula, estilo]}>
      <Svg width={20} height={20} viewBox="-10 -10 20 20">
        <Path d={ESTRELLA} fill={color} />
      </Svg>
    </Animated.View>
  );
}

/** Contorno del trazo entre la cola `c` y la cabeza `h` (fracciones de la curva): fino atrás, grueso adelante. */
function contornoTrazo(t: Trazo, c: number, h: number, factor: number) {
  'worklet';
  if (h - c < 0.002) return 'M0 0';
  const N = 18;
  const izq: string[] = [];
  const der: string[] = [];
  for (let i = 0; i <= N; i++) {
    const s = c + ((h - c) * i) / N;
    const u = 1 - s;
    const x = u * u * t.ax + 2 * u * s * t.kx + s * s * t.bx;
    const y = u * u * t.ay + 2 * u * s * t.ky + s * s * t.by;
    const dx = 2 * u * (t.kx - t.ax) + 2 * s * (t.bx - t.kx);
    const dy = 2 * u * (t.ky - t.ay) + 2 * s * (t.by - t.ky);
    const L = Math.max(0.001, Math.hypot(dx, dy));
    const w = (t.ancho * factor * (i / N)) / 2;
    izq.push(`${x - (dy / L) * w} ${y + (dx / L) * w}`);
    der.push(`${x + (dy / L) * w} ${y - (dx / L) * w}`);
  }
  return `M${izq.join('L')}L${der.reverse().join('L')}Z`;
}

function puntaTrazo(t: Trazo, c: number, h: number, factor: number) {
  'worklet';
  const u = 1 - h;
  return {
    cx: u * u * t.ax + 2 * u * h * t.kx + h * h * t.bx,
    cy: u * u * t.ay + 2 * u * h * t.ky + h * h * t.by,
    r: h - c < 0.002 ? 0 : (t.ancho * factor) / 2,
  };
}

/** Un salto: `n` cambia en cada cambio de mundo; `dir` 1 = viaja hacia la derecha, -1 = hacia la izquierda. */
export interface SaltoCeti {
  n: number;
  dir: 1 | -1;
}

export default function CetiViajera({
  ancho,
  alto,
  x,
  y,
  tam,
  salto,
}: {
  /** Área donde se dibujan el trazo y las partículas (la de Ceti queda dentro). */
  ancho: number;
  alto: number;
  /** Centro de Ceti en el área. */
  x: number;
  y: number;
  /** Ancho de Ceti de frente, en px. */
  tam: number;
  salto: SaltoCeti | null;
}) {
  const reducir = useReducedMotion();
  const TAM = Math.round(tam);
  const LADO = TAM * ALTO_LOTTIE; // caja cuadrada del Lottie (CetiAnimation dibuja size × size)
  const k = (TAM * 0.94) / ANCHO_FRENTE_HOJA;

  const [pose, setPose] = useState<Pose>('frente');
  const [mira, setMira] = useState(1);

  // estado del cuerpo: desplazamiento, giro y estirón en su propio eje
  const bx = useSharedValue(0);
  const by = useSharedValue(0);
  const giro = useSharedValue(0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const esc = useSharedValue(1);
  const opa = useSharedValue(0); // escondida hasta el primer salto

  const reloj = useSharedValue(0);
  const estrellas = useSharedValue<Particula[]>(Array.from({ length: N_ESTRELLAS }, () => VACIA));
  const trazo = useSharedValue<Trazo>({ ax: 0, ay: 0, kx: 0, ky: 0, bx: 0, by: 0, ancho: 0 });
  const cabeza = useSharedValue(0);
  const cola = useSharedValue(1);
  const portal = useSharedValue(0); // escala del portal (0 = cerrado)
  // mientras se mete en el portal, el borde del portal la recorta
  const [recorte, setRecorte] = useState(false);

  // el reloj de las partículas solo corre mientras dura un salto
  const reloj$ = useFrameCallback((f) => {
    reloj.value = f.timeSinceFirstFrame;
  }, false);

  // copias en JS de los grupos de partículas (se llenan en anillo)
  const espejo = useRef({
    estrellas: Array.from({ length: N_ESTRELLAS }, () => VACIA),
    ie: 0,
  });

  const cuerpo = useAnimatedStyle(() => ({
    opacity: opa.value,
    transform: [
      { translateX: bx.value },
      { translateY: by.value },
      { rotate: `${giro.value}deg` },
      { scaleX: sx.value * esc.value },
      { scaleY: sy.value * esc.value },
    ],
  }));
  const estiloPortal = useAnimatedStyle(() => ({
    opacity: portal.value > 0.01 ? 1 : 0,
    transform: [{ rotate: `${PORTAL_GIRO}deg` }, { scale: portal.value }],
  }));
  const trazoFuera = useAnimatedProps(() => ({
    d: contornoTrazo(trazo.value, cola.value, cabeza.value, 1),
  }));
  const trazoDentro = useAnimatedProps(() => ({
    d: contornoTrazo(trazo.value, cola.value, cabeza.value, 0.55),
  }));
  const puntaFuera = useAnimatedProps(() => puntaTrazo(trazo.value, cola.value, cabeza.value, 1));
  const puntaDentro = useAnimatedProps(() =>
    puntaTrazo(trazo.value, cola.value, cabeza.value, 0.55)
  );

  const lugar = useRef({ x, y, TAM });
  lugar.current = { x, y, TAM };

  useEffect(() => {
    if (!salto) return;
    let viva = true;
    const relojes = new Set<ReturnType<typeof setTimeout>>();
    const esperar = (ms: number) =>
      new Promise<void>((listo, falla) => {
        const id = setTimeout(() => {
          relojes.delete(id);
          if (viva) listo();
          else falla(CANCELADO);
        }, ms);
        relojes.add(id);
      });
    const { x: cx, y: cy, TAM: T } = lugar.current;
    const t = (ms: number, easing = Easing.inOut(Easing.cubic)) => ({ duration: ms, easing });
    const VISIBLE = 100; // lo que se queda de frente antes de irse por el portal

    if (reducir) {
      // sin vuelo: aparece y desaparece con un fundido
      cancelAnimation(opa);
      setPose('frente');
      opa.value = withSequence(withTiming(1, t(250)), withDelay(VISIBLE, withTiming(0, t(250))));
      return () => {
        viva = false;
      };
    }
    reloj$.setActive(true);

    const lanzarEstrellas = (px: number, py: number, n: number, vel: number) => {
      const e = espejo.current;
      const ahora = reloj.value;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = vel * azar(0.45, 1.2);
        e.estrellas[e.ie] = {
          x: px,
          y: py,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          t0: ahora,
          dur: azar(450, 800),
          tam: T * azar(0.06, 0.12),
          giro: Math.random() * 3,
        };
        e.ie = (e.ie + 1) % N_ESTRELLAS;
      }
      estrellas.value = e.estrellas.slice();
    };

    // gira de perfil a frente con un saltito, pasando por la pose de tres cuartos
    const mirarAlFrente = async () => {
      by.value = withSequence(
        withTiming(-T * 0.12, t(180, Easing.out(Easing.quad))),
        withTiming(0, t(180, Easing.in(Easing.quad)))
      );
      sx.value = withSequence(withTiming(0.92, t(180)), withTiming(1, t(180)));
      sy.value = withSequence(withTiming(1.05, t(180)), withTiming(1, t(180)));
      await esperar(110);
      setPose('tres-cuartos');
      await esperar(115);
      setPose('frente');
      await esperar(135);
    };

    async function llegar() {
      // el mundo ya cambió: Ceti se esconde y llega volando desde el lado del que viene
      const s = salto!.dir;
      for (const v of [bx, by, giro, sx, sy, esc, opa, cabeza, cola, portal]) cancelAnimation(v);
      portal.value = 0;
      setRecorte(false);
      opa.value = 0;
      bx.value = 0;
      by.value = 0;
      setMira(s);
      setPose('disparada');
      const ang = (s > 0 ? 0 : Math.PI) + azar(-0.25, 0.25);
      const largo = T * azar(2.2, 3);
      const a: [number, number] = [cx - Math.cos(ang) * largo, cy - Math.sin(ang) * largo];
      const curva = s * azar(-0.15, 0.15) * largo;
      trazo.value = {
        ax: a[0],
        ay: a[1],
        bx: cx,
        by: cy,
        kx: (a[0] + cx) / 2 + (-(cy - a[1]) / largo) * curva,
        ky: (a[1] + cy) / 2 + ((cx - a[0]) / largo) * curva,
        ancho: T * 0.32,
      };
      cola.value = 0;
      cabeza.value = 0;
      cabeza.value = withTiming(1, t(160, Easing.out(Easing.cubic)));
      await esperar(160);

      // sale del trazo estirada y frena con un rebote
      const incl = ((s > 0 ? ang : ang - Math.PI) * 180) / Math.PI;
      giro.value = incl;
      sx.value = 1.4;
      sy.value = 0.82;
      esc.value = 0;
      opa.value = 1;
      cola.value = withTiming(1, t(340));
      esc.value = withTiming(1, t(160, Easing.out(Easing.cubic)));
      await esperar(160);
      setPose('frenando');
      const rebote = t(420, Easing.out(Easing.back(1.7)));
      giro.value = withSequence(withTiming(incl * 0.4 - s * 8, t(200)), withTiming(0, t(220)));
      sx.value = withSequence(withTiming(0.85, t(120)), withTiming(1, rebote));
      sy.value = withSequence(withTiming(1.1, t(120)), withTiming(1, rebote));
      await esperar(540 + 200);

      // se relaja de perfil y vuelve a mirar al frente
      setPose('perfil');
      by.value = withSequence(withTiming(-T * 0.04, t(160)), withTiming(0, t(160)));
      await esperar(320);
      await mirarAlFrente();

      // se queda un momento y se va por un portal: se abre bajo ella, se mete y se cierra
      await esperar(VISIBLE);
      const L = T * ALTO_LOTTIE;
      setRecorte(true);
      portal.value = withSequence(
        withTiming(1.12, t(150, Easing.out(Easing.cubic))),
        withTiming(0.96, t(80)),
        withTiming(1, t(70))
      );
      sx.value = withTiming(1.08, t(200));
      sy.value = withTiming(0.92, t(200));
      await esperar(200);
      by.value = withSequence(
        withTiming(-T * 0.14, t(160, Easing.out(Easing.quad))),
        withTiming(L * 0.95, t(300, Easing.in(Easing.cubic)))
      );
      sx.value = withSequence(withTiming(0.94, t(160)), withTiming(0.88, t(300)));
      sy.value = withSequence(withTiming(1.06, t(160)), withTiming(1.12, t(300)));
      await esperar(160 + 220);
      // la única ráfaga: unas pocas estrellitas al desaparecer en el portal (sin humo)
      lanzarEstrellas(cx, cy + L * PORTAL_Y, 6, T * 1.4);
      await esperar(120);
      opa.value = 0;
      portal.value = withSequence(
        withTiming(1.08, t(100)),
        withTiming(0, t(220, Easing.in(Easing.back(2))))
      );
      await esperar(340);
      setRecorte(false);
      by.value = 0;
      sx.value = 1;
      sy.value = 1;
      setPose('frente');
      await esperar(700); // que terminen las estrellitas antes de parar el reloj
      // con el reloj parado, ninguna partícula puede quedarse congelada a la vista
      espejo.current.estrellas = Array.from({ length: N_ESTRELLAS }, () => VACIA);
      estrellas.value = espejo.current.estrellas.slice();
      reloj$.setActive(false);
    }
    llegar().catch(() => {});

    return () => {
      viva = false;
      relojes.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salto?.n, reducir]);

  // al desmontar: nada queda a medias
  useEffect(
    () => () => {
      reloj$.setActive(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (ancho <= 0 || alto <= 0) return null;
  const rxP = TAM * 0.5;
  const ryP = rxP * PORTAL_ALTO;
  const yP = y + LADO * PORTAL_Y;

  return (
    <View style={[StyleSheet.absoluteFill, { width: ancho, height: alto }]} pointerEvents="none">
      <Svg width={ancho} height={alto} style={StyleSheet.absoluteFill}>
        <AnimatedPath animatedProps={trazoFuera} fill={NARANJA} />
        <AnimatedCircle animatedProps={puntaFuera} fill={NARANJA} />
        <AnimatedPath animatedProps={trazoDentro} fill={AMARILLO} />
        <AnimatedCircle animatedProps={puntaDentro} fill={AMARILLO} />
      </Svg>
      <Animated.View
        style={[
          estilos.portal,
          { left: x - rxP - 2, top: yP - ryP - 2, width: 2 * rxP + 4, height: 2 * ryP + 4 },
          estiloPortal,
        ]}
      >
        <Svg
          width={2 * rxP + 4}
          height={2 * ryP + 4}
          viewBox={`${-rxP - 2} ${-ryP - 2} ${2 * rxP + 4} ${2 * ryP + 4}`}
        >
          <Ellipse cx={0} cy={0} rx={rxP} ry={ryP} fill={PORTAL_BORDE} />
          <Ellipse cx={0} cy={0} rx={rxP * 0.957} ry={ryP * 0.92} fill={PORTAL_FONDO} />
          {PORTAL_PUNTOS.map(([px, py], i) => (
            <Circle
              key={i}
              cx={px * rxP}
              cy={py * ryP}
              r={Math.max(0.8, rxP * 0.018)}
              fill="#FFFFFF"
              opacity={0.8}
            />
          ))}
          {PORTAL_CHISPAS.map(([px, py, e], i) => (
            <Path
              key={i}
              d={ESTRELLA}
              fill="#FFFFFF"
              transform={`translate(${px * rxP} ${py * ryP}) scale(${(e * rxP) / 160})`}
            />
          ))}
        </Svg>
      </Animated.View>
      {/* recorte: todo lo que queda por encima del centro del portal (al meterse, desaparece en él) */}
      <View
        style={[
          estilos.ceti,
          {
            left: x - 1.5 * LADO,
            top: yP - 2.5 * LADO,
            width: 3 * LADO,
            height: 2.5 * LADO,
            overflow: recorte ? 'hidden' : 'visible',
          },
        ]}
      >
        <View
          style={[
            estilos.ceti,
            { width: LADO, height: LADO, left: LADO, top: 2.5 * LADO - (yP - y) - LADO * CENTRO_Y },
          ]}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transformOrigin: [LADO / 2, LADO * CENTRO_Y, 0] },
              cuerpo,
            ]}
          >
            <View style={[StyleSheet.absoluteFill, { opacity: pose === 'frente' ? 1 : 0 }]}>
              <CetiAnimation id="mascot.ceti-vuelo-reposo" size={LADO} />
            </View>
            {(Object.keys(POSES) as (keyof typeof POSES)[]).map((nombre) => {
              const { Svg: Dibujo, w, h } = POSES[nombre];
              return (
                <View
                  key={nombre}
                  style={{
                    position: 'absolute',
                    left: LADO / 2 - (w * k) / 2,
                    top: LADO * CENTRO_Y - (h * k) / 2,
                    width: w * k,
                    height: h * k,
                    opacity: pose === nombre ? 1 : 0,
                    transform: [{ scaleX: mira }],
                  }}
                >
                  <Dibujo width={w * k} height={h * k} />
                </View>
              );
            })}
          </Animated.View>
        </View>
      </View>
      {Array.from({ length: N_ESTRELLAS }, (_, i) => (
        <Estrellita
          key={`e${i}`}
          i={i}
          lista={estrellas}
          reloj={reloj}
          color={i % 3 === 2 ? CREMA : AMARILLO}
        />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  ceti: { position: 'absolute' },
  portal: { position: 'absolute' },
  particula: { position: 'absolute', left: 0, top: 0, width: 20, height: 20 },
});
