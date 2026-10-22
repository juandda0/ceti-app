/**
 * Carrusel orbital de Tu Galaxia: el mundo activo va grande en el centro y los vecinos asoman a los
 * lados, más pequeños. Se desliza con el dedo o con las flechas; tocar el planeta del centro abre su
 * ficha. Solo el planeta del centro se anima (los demás quedan en su primer fotograma) para no tener
 * varios Lottie corriendo a la vez. Ceti aparece un momento arriba a la izquierda (bajo el subtítulo) al
 * abrir la galaxia y en cada cambio de mundo, llegando desde el lado del que viene (CetiViajera).
 */
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Ellipse } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CetiAnimation } from '@features/animations';
import type { Planeta } from '@features/learning/data/planetas';
import { ESPACIO } from './espacio';
import CetiViajera, { type SaltoCeti } from './CetiViajera';

export interface PlanetaCarrusel {
  id: string;
  nombre: string;
  planeta: Planeta;
  bloqueado: boolean;
}

// Los planetas vecinos salen del ancho. En web, `overflow: hidden` todavía se desplaza al enfocar un
// botón (el navegador lo trae a la vista y la galaxia queda corrida); `clip` recorta sin desplazar.
const RECORTE = (
  Platform.OS === 'web' ? { overflow: 'clip' } : { overflow: 'hidden' }
) as ViewStyle;

const RESORTE = { damping: 18, stiffness: 150, mass: 0.9 };

function clamp(v: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(v, min), max);
}

function Orbe({
  indice,
  pos,
  separacion,
  tam,
  item,
  activo,
}: {
  indice: number;
  pos: SharedValue<number>;
  separacion: number;
  tam: number;
  item: PlanetaCarrusel;
  activo: boolean;
}) {
  const estilo = useAnimatedStyle(() => {
    const d = indice - pos.value;
    const ad = Math.abs(d);
    return {
      opacity: interpolate(ad, [0, 1, 2.2], [1, 0.95, 0], 'clamp'),
      zIndex: Math.round(10 - ad * 2),
      transform: [
        { translateX: d * separacion },
        { scale: interpolate(ad, [0, 1, 2], [1, 0.46, 0.34], 'clamp') },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: tam, height: tam }, estilo]}
    >
      <View style={{ opacity: item.bloqueado ? 0.32 : 1 }}>
        <CetiAnimation
          key={activo ? 'vivo' : 'quieto'}
          id={item.planeta.animacion}
          size={tam}
          autoPlay={activo && !item.bloqueado}
        />
      </View>
      {item.bloqueado ? (
        <View style={styles.candado}>
          <Ionicons name="lock-closed" size={30} color={ESPACIO.textoSuave} />
        </View>
      ) : null}
    </Animated.View>
  );
}

export default function CarruselPlanetas({
  mundos,
  activo,
  onCambio,
  onTocar,
  ancho,
  alto,
}: {
  mundos: PlanetaCarrusel[];
  activo: number;
  onCambio: (indice: number) => void;
  onTocar: (indice: number) => void;
  ancho: number;
  alto: number;
}) {
  const { t } = useTranslation();
  const n = mundos.length;
  const tam = Math.min(260, ancho * 0.66, alto * 0.9);
  const separacion = ancho * 0.6;
  const pos = useSharedValue(activo);
  const inicio = useSharedValue(activo);

  useEffect(() => {
    pos.value = withSpring(activo, RESORTE);
  }, [activo, pos]);

  // al abrir la galaxia y en cada cambio de mundo, Ceti llega volando hacia ese lado
  const previo = useRef(activo);
  const [salto, setSalto] = useState<SaltoCeti>({ n: 1, dir: 1 });
  useEffect(() => {
    if (activo === previo.current) return;
    const dir = activo > previo.current ? 1 : -1;
    previo.current = activo;
    setSalto((s) => ({ n: s.n + 1, dir }));
  }, [activo]);

  const tocar = () => onTocar(activo);

  const arrastre = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onStart(() => {
      inicio.value = pos.value;
    })
    .onUpdate((e) => {
      pos.value = clamp(inicio.value - e.translationX / separacion, -0.35, n - 0.65);
    })
    .onEnd((e) => {
      const destino = clamp(Math.round(pos.value - (e.velocityX / separacion) * 0.18), 0, n - 1);
      pos.value = withSpring(destino, RESORTE);
      runOnJS(onCambio)(destino);
    });
  const toque = Gesture.Tap().onEnd(() => {
    runOnJS(tocar)();
  });

  const actual = mundos[activo];
  // Ceti: arriba a la izquierda, con el cuerpo justo dentro del borde superior del carrusel
  const tamCeti = tam * 0.26;
  const ladoCeti = tamCeti * (770 / 640);

  return (
    <View style={{ width: ancho, height: alto }}>
      <View style={[{ width: ancho, height: alto }, RECORTE]}>
        <Svg width={ancho} height={alto} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Ellipse
            cx={ancho / 2}
            cy={alto / 2}
            rx={ancho * 0.78}
            ry={alto * 0.22}
            fill="none"
            stroke={ESPACIO.lineaSuave}
            strokeWidth={3}
            strokeDasharray="2 12"
            strokeLinecap="round"
          />
        </Svg>

        <GestureDetector gesture={Gesture.Exclusive(arrastre, toque)}>
          <View
            style={styles.escena}
            accessible
            accessibilityRole="button"
            accessibilityLabel={
              actual ? t('galaxia.verMundo', { nombre: actual.nombre }) : undefined
            }
            accessibilityHint={t('galaxia.deslizaHint')}
          >
            {mundos.map((m, i) => (
              <Orbe
                key={m.id}
                indice={i}
                pos={pos}
                separacion={separacion}
                tam={tam}
                item={m}
                activo={i === activo}
              />
            ))}
          </View>
        </GestureDetector>

        {activo > 0 ? (
          <Pressable
            onPress={() => onCambio(activo - 1)}
            accessibilityRole="button"
            accessibilityLabel={t('galaxia.anterior')}
            style={[styles.flecha, { left: 14, top: alto / 2 - 22 }]}
          >
            <Ionicons name="chevron-back" size={22} color={ESPACIO.texto} />
          </Pressable>
        ) : null}
        {activo < n - 1 ? (
          <Pressable
            onPress={() => onCambio(activo + 1)}
            accessibilityRole="button"
            accessibilityLabel={t('galaxia.siguiente')}
            style={[styles.flecha, { right: 14, top: alto / 2 - 22 }]}
          >
            <Ionicons name="chevron-forward" size={22} color={ESPACIO.texto} />
          </Pressable>
        ) : null}
      </View>

      {/* fuera del recorte: las estrellitas y el trazo pueden salirse del carrusel */}
      {n > 0 ? (
        <CetiViajera
          ancho={ancho}
          alto={alto}
          x={20 + tamCeti * 0.5}
          y={ladoCeti * 0.35 + 6}
          tam={tamCeti}
          salto={salto}
        />
      ) : null}
    </View>
  );
}

/** Puntos bajo el carrusel: dorado = conquistado, acento = el actual, gris = el resto. */
export function PuntosCarrusel({
  total,
  activo,
  conquistados,
  acento,
}: {
  total: number;
  activo: number;
  conquistados: readonly boolean[];
  acento: string;
}) {
  return (
    <View
      style={styles.puntos}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.punto,
            i === activo
              ? { width: 26, backgroundColor: acento }
              : { backgroundColor: conquistados[i] ? ESPACIO.oro : '#3A3A66' },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  escena: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  candado: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 64,
    height: 64,
    marginLeft: -32,
    marginTop: -32,
    borderRadius: 999,
    backgroundColor: '#2A2A4A',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#15152C',
  },
  flecha: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: ESPACIO.boton,
    borderBottomWidth: 3,
    borderBottomColor: ESPACIO.sombra,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  puntos: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  punto: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
