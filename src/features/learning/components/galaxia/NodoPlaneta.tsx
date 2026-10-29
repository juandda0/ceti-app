/**
 * Un nivel del mapa dibujado como un planetita plano, calcado de la propuesta de Gemini
 * (`assets/brand/bocetos/nodo-01-propuesta.png`) sin sus brillos:
 *
 * - `anillo`: la bola con su sombra plana abajo y un anillo inclinado.
 * - `liso`: la bola con su sombra, sin anillo (así no todos los niveles son iguales).
 * - `jefe`: más grande, con picos dorados detrás, cráteres, una órbita con dos lunas que
 *   giran en bucle (por delante y por detrás del planeta) y un par de puntitos dorados cerca. Mientras no se vence lleva su calavera dibujada
 *   (no el ícono), calcada de la propuesta.
 *
 * El nivel por el que vas (`actual`) va sin anillo y con un cráter arriba donde se clava la
 * bandera (`nodo-02-bandera.png`, opción 4); la bandera la pone el mapa encima.
 *
 * Se dibuja en una caja de 160 unidades centrada en el planeta (radio 50 = la mitad del nodo),
 * así que el SVG mide 1,6 veces el nodo y se sale de él por los lados.
 */
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { useReducedMotionSafe } from '@shared/constants/motion';

export type FormaNodo = 'anillo' | 'liso' | 'jefe';

export const ESCALA_SVG = 1.6;

/** Hasta dónde llega el dibujo a cada lado del centro, en fracción del tamaño del nodo. */
export function alcanceNodo(forma: FormaNodo): number {
  return forma === 'liso' ? 0.52 : 0.72;
}

/** Cráter de la bandera: sobre la cara de arriba, corrido a un lado (`lado` −1 o 1). */
export const CRATER_BANDERA = { x: 17.5, y: -42 };

const APAGADO = { bola: '#2B2A30', sombra: '#1A191E', anillo: '#3A3B40', picos: '#323138', crater: '#25242A' };
const ORO = '#E9B44F';
const PICOS = '#DDA443';

function canales(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** `a` mezclado con `b` (t = cuánto de `b`). */
export function mezclar(a: string, b: string, t: number) {
  const ca = canales(a);
  const cb = canales(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// Sombra plana: la parte de la bola que queda por debajo de la misma bola subida 13 unidades.
const SOMBRA = 'M-49.58 -6.5 A50 50 0 1 0 49.58 -6.5 A50 50 0 0 1 -49.58 -6.5 Z';
// Anillo de una lección: un poco bajo y subiendo hacia la derecha.
const ANILLO = { rx: 69, ry: 19, dy: 7, giro: -15, grosor: 5 };
// Jefe: órbita empinada, picos anchos y cráteres.
const ORBITA = { rx: 66, ry: 16, giro: -34, grosor: 4, luna: 5.5 };
/** Una vuelta completa de las lunas del jefe. */
const VUELTA_MS = 7000;
const CRATERES: readonly [number, number, number, number][] = [
  [29, -30, 6.5, 4],
  [38, 16, 3.2, 3.2],
  [14, 37, 3, 3],
];
const PUNTOS_ORO: readonly [number, number, number][] = [
  [-34, -57, 2.6],
  [61, 24, 3.2],
];

// Calavera del jefe, calcada de la propuesta: una sola pieza, cúpula ancha que se cierra en los
// pómulos y termina en tres dientes redondos. Por dentro es toda blanca; la sombra es la misma
// calavera en el tono oscuro del planeta, corrida hacia abajo (luz de arriba, casi al centro).
const CRANEO =
  'M0 -25.9 C13.4 -25.9 24.3 -16.5 24.3 -3.5 C24.3 1.5 23.2 4.5 21.5 6.1 C19.5 8.6 16.8 10.2 14.7 11 ' +
  'C13.9 13.5 13.6 15.5 13.6 17.5 C13.6 19.6 11.8 21 9.2 21 C6.8 21 5.4 19 4.8 15.4 ' +
  'C4.3 19 2.6 21 0 21 C-2.6 21 -4.3 19 -4.8 15.4 C-5.4 19 -6.8 21 -9.2 21 ' +
  'C-11.8 21 -13.6 19.6 -13.6 17.5 C-13.6 15.5 -13.9 13.5 -14.7 11 C-16.8 10.2 -19.5 8.6 -21.5 6.1 ' +
  'C-23.2 4.5 -24.3 1.5 -24.3 -3.5 C-24.3 -16.5 -13.4 -25.9 0 -25.9 Z';
const NARIZ = 'M0 0.8 C0.9 0.8 3.4 5.2 3.4 6.4 C3.4 7.4 2.6 7.6 0 7.6 C-2.6 7.6 -3.4 7.4 -3.4 6.4 C-3.4 5.2 -0.9 0.8 0 0.8 Z';

function Calavera({ hueso, sombra, hueco }: { hueso: string; sombra: string; hueco: string }) {
  return (
    <G>
      <G transform="translate(-0.6 3)">
        <Path d={CRANEO} fill={sombra} />
      </G>
      <Path d={CRANEO} fill={hueso} />
      <Circle cx={-10.95} cy={-3.2} r={6.8} fill={hueco} />
      <Circle cx={10.95} cy={-3.2} r={6.8} fill={hueco} />
      <Path d={NARIZ} fill={hueco} />
    </G>
  );
}

function picos(puntas: number, fuera: number, dentro: number) {
  const pts: string[] = [];
  for (let i = 0; i < puntas * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / puntas;
    const r = i % 2 === 0 ? fuera : dentro;
    pts.push(`${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}
const CORONA = picos(8, 59, 44);

/** Medio arco de elipse centrada: `atras` = la mitad de arriba, que queda detrás de la bola. */
const medio = (rx: number, ry: number, atras: boolean) =>
  atras ? `M${-rx} 0 A${rx} ${ry} 0 0 1 ${rx} 0` : `M${rx} 0 A${rx} ${ry} 0 0 1 ${-rx} 0`;

/**
 * Una luna del jefe sobre su órbita. Hay dos copias de cada luna: la de `atras` se ve solo en la
 * mitad de arriba (queda tapada por el planeta, que va encima) y la de delante en la de abajo.
 */
function Luna({
  vuelta,
  fase,
  atras,
  lado,
  color,
}: {
  vuelta: SharedValue<number>;
  fase: number;
  atras: boolean;
  lado: number;
  color: string;
}) {
  const u = lado / 160;
  const r = ORBITA.luna * u;
  const g = (ORBITA.giro * Math.PI) / 180;
  const estilo = useAnimatedStyle(() => {
    const t = vuelta.value + fase;
    const ex = ORBITA.rx * Math.cos(t);
    const ey = ORBITA.ry * Math.sin(t);
    const x = ex * Math.cos(g) - ey * Math.sin(g);
    const y = ex * Math.sin(g) + ey * Math.cos(g);
    return {
      opacity: (ey < 0) === atras ? 1 : 0,
      transform: [{ translateX: x * u }, { translateY: y * u }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: lado / 2 - r, top: lado / 2 - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: color },
        estilo,
      ]}
    />
  );
}

function Lunas({ vuelta, atras, lado, color }: { vuelta: SharedValue<number>; atras: boolean; lado: number; color: string }) {
  return (
    <>
      <Luna vuelta={vuelta} fase={0} atras={atras} lado={lado} color={color} />
      <Luna vuelta={vuelta} fase={Math.PI} atras={atras} lado={lado} color={color} />
    </>
  );
}

export default function NodoPlaneta({
  tam,
  forma,
  color,
  bloqueado,
  bandera,
  calavera = false,
}: {
  tam: number;
  forma: FormaNodo;
  /** Nivel actual: lado (−1 o 1) del cráter donde va clavada la bandera. */
  bandera?: number;
  /** Jefe sin vencer: su calavera va dibujada aquí (el ícono de encima se omite). */
  calavera?: boolean;
  /** Color de la bola (naranja si está hecho, el acento del planeta si es el actual). */
  color: string;
  bloqueado: boolean;
}) {
  const lado = tam * ESCALA_SVG;
  const bola = bloqueado ? APAGADO.bola : color;
  const sombra = bloqueado ? APAGADO.sombra : mezclar(color, '#000000', 0.24);
  const jefe = forma === 'jefe';
  const anillo = bloqueado ? APAGADO.anillo : jefe ? ORO : mezclar(color, '#000000', 0.25);
  const reducido = useReducedMotionSafe();
  const vuelta = useSharedValue(0);
  useEffect(() => {
    if (!jefe || reducido) return;
    vuelta.value = withRepeat(withTiming(Math.PI * 2, { duration: VUELTA_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(vuelta);
  }, [jefe, reducido, vuelta]);

  const aro = (atras: boolean) =>
    jefe ? (
      <G transform={`rotate(${ORBITA.giro})`}>
        <Path d={medio(ORBITA.rx, ORBITA.ry, atras)} stroke={anillo} strokeWidth={ORBITA.grosor} fill="none" />
      </G>
    ) : (
      <G transform={`rotate(${ANILLO.giro}) translate(0 ${ANILLO.dy})`}>
        <Path
          d={medio(ANILLO.rx, ANILLO.ry, atras)}
          stroke={anillo}
          strokeWidth={ANILLO.grosor}
          strokeLinecap="round"
          fill="none"
        />
      </G>
    );
  const conAro = forma === 'anillo' || jefe;

  // El jefe va en dos capas para que sus lunas pasen por detrás del planeta y por delante.
  const capa = (hijos: ReactNode) => (
    <Svg pointerEvents="none" width={lado} height={lado} viewBox="-80 -80 160 160" style={StyleSheet.absoluteFill}>
      {hijos}
    </Svg>
  );
  const fondo = (
    <>
      {jefe && <Path d={CORONA} fill={bloqueado ? APAGADO.picos : PICOS} />}
      {conAro && aro(true)}
    </>
  );
  const frente = (
    <>
      <Circle cx={0} cy={0} r={50} fill={bola} />
      <Path d={SOMBRA} fill={sombra} />
      {jefe &&
        CRATERES.map(([x, y, rx, ry], i) => (
          <Ellipse
            key={i}
            cx={x}
            cy={y}
            rx={rx}
            ry={ry}
            fill={bloqueado ? APAGADO.crater : mezclar(color, '#000000', 0.2)}
          />
        ))}
      {bandera !== undefined && (
        <Ellipse
          cx={bandera * CRATER_BANDERA.x}
          cy={CRATER_BANDERA.y}
          rx={9}
          ry={3.6}
          fill={mezclar(color, '#000000', 0.3)}
        />
      )}
      {calavera && (
        <Calavera
          hueso={bloqueado ? '#4A4A52' : '#FFFFFF'}
          sombra={bloqueado ? '#1F1E24' : mezclar(color, '#000000', 0.22)}
          hueco={bloqueado ? APAGADO.bola : mezclar(color, '#000000', 0.22)}
        />
      )}
      {conAro && aro(false)}
      {jefe &&
        !bloqueado &&
        PUNTOS_ORO.map(([x, y, r], i) => <Circle key={`o${i}`} cx={x} cy={y} r={r} fill={ORO} />)}
    </>
  );

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: (tam - lado) / 2, top: (tam - lado) / 2, width: lado, height: lado }}
    >
      {jefe ? (
        <>
          {capa(fondo)}
          <Lunas vuelta={vuelta} atras lado={lado} color={anillo} />
          {capa(frente)}
          <Lunas vuelta={vuelta} atras={false} lado={lado} color={anillo} />
        </>
      ) : (
        capa(
          <>
            {fondo}
            {frente}
          </>
        )
      )}
    </View>
  );
}
