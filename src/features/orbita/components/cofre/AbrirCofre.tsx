/**
 * Entrega de un cofre (la primera lección del planeta o el jefe, la primera vez que se ganan):
 * el cofre al centro, se toca tres veces
 * (las dos primeras lo sacuden y se queda quieto, la tercera lo abre), salta el candado, la tapa gira sobre la bisagra y
 * salen las monedas. Los Cetis ya se sumaron al terminar el nivel; aquí se reclaman.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';
import { MonedaCeti } from '@features/orbita/components/iconos';
import { CapasCofre } from '@features/orbita/components/cofre/Cofre';
import { BISAGRA, LADO_COFRE } from '@features/orbita/components/cofre/piezas';
import { enterSoftFade, enterSoftScale, useReducedMotionSafe } from '@shared/constants/motion';
import { useThemeColors } from '@shared/hooks/useThemeColors';

const TAM = 240;
/** Distancia de la bisagra al centro del cofre, en puntos de pantalla. */
const PIVOTE = (BISAGRA / LADO_COFRE - 0.5) * TAM;
const TOQUES = 3;
const MONEDAS = 12;
const PISTAS = ['orbita.cofre.toca', 'orbita.cofre.otraVez', 'orbita.cofre.unaMas'] as const;

/** Escala vertical alrededor de la bisagra (no del centro). */
function giroTapa(s: number) {
  'worklet';
  return [{ translateY: PIVOTE }, { scaleY: s }, { translateY: -PIVOTE }];
}

function MonedaQueSale({ i, salida }: { i: number; salida: SharedValue<number> }) {
  // Abanico hacia arriba, cada moneda con su ángulo y su fuerza (deterministas).
  const angulo = (-150 + (120 * i) / (MONEDAS - 1)) * (Math.PI / 180);
  const fuerza = 150 + ((i * 37) % 5) * 22;
  const alto = 190 + ((i * 53) % 4) * 30;
  const estilo = useAnimatedStyle(() => {
    const t = salida.value;
    return {
      opacity: t <= 0 ? 0 : t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25,
      transform: [
        { translateX: Math.cos(angulo) * fuerza * t },
        { translateY: -alto * 2 * t + alto * 1.6 * t * t },
        { scale: 0.6 + 0.4 * Math.min(1, t * 3) },
        { rotate: `${(i % 2 ? 1 : -1) * 220 * t}deg` },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[st.moneda, estilo]}>
      <MonedaCeti size={30} />
    </Animated.View>
  );
}

export default function AbrirCofre({
  titulo,
  subtitulo,
  color,
  cetis,
  onReclamar,
}: {
  titulo: string;
  subtitulo: string;
  color: string;
  cetis: number;
  onReclamar: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const reducido = useReducedMotionSafe();
  const [toques, setToques] = useState(0);
  const abierto = toques >= TOQUES;
  const montado = useRef(true);
  useEffect(() => () => void (montado.current = false), []);

  const sacudida = useSharedValue(0);
  const aplaste = useSharedValue(1);
  const tapaCerrada = useSharedValue(1);
  const tapaAbierta = useSharedValue(0);
  const candado = useSharedValue(0);
  const salida = useSharedValue(0);

  const tocar = () => {
    if (abierto) return;
    const n = toques + 1;
    setToques(n);
    if (n < TOQUES) {
      void Haptics.impactAsync(n === 1 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
      if (reducido) return;
      // Tiembla un instante (cada toque un poco más fuerte) y se queda quieto.
      const f = 1 + (n - 1) * 0.4;
      const suave = { easing: Easing.inOut(Easing.sin) };
      sacudida.value = withSequence(
        withTiming(-f, { duration: 70, ...suave }),
        withTiming(0.8 * f, { duration: 100, ...suave }),
        withTiming(-0.45 * f, { duration: 100, ...suave }),
        withTiming(0.15 * f, { duration: 90, ...suave }),
        withTiming(0, { duration: 80, ...suave })
      );
      aplaste.value = withSequence(
        withTiming(1 - 0.06 * f, { duration: 80, easing: Easing.out(Easing.quad) }),
        withTiming(1.02, { duration: 120, ...suave }),
        withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) })
      );
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    sacudida.value = withTiming(0, { duration: 80 });
    if (reducido) {
      tapaCerrada.value = 0;
      tapaAbierta.value = 1;
      candado.value = 1;
      return;
    }
    aplaste.value = withSequence(
      withTiming(0.86, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(1.05, { duration: 150, easing: Easing.inOut(Easing.sin) }),
      withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) })
    );
    candado.value = withTiming(1, { duration: 650, easing: Easing.in(Easing.quad) });
    tapaCerrada.value = withDelay(110, withTiming(0, { duration: 120, easing: Easing.in(Easing.quad) }));
    tapaAbierta.value = withDelay(
      230,
      withSequence(
        withTiming(1.06, { duration: 170, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 140, easing: Easing.inOut(Easing.sin) })
      )
    );
    // Tiempo lineal: la parábola ya hace que suban rápido y caigan; sin frenar al final.
    salida.value = withDelay(260, withTiming(1, { duration: 950, easing: Easing.linear }));
  };

  const estiloCofre = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${6 * sacudida.value}deg` },
      { scaleY: aplaste.value },
      { scaleX: 2 - aplaste.value },
    ],
  }));
  const estiloTapaCerrada = useAnimatedStyle(() => ({ transform: giroTapa(tapaCerrada.value) }));
  const estiloTapaAbierta = useAnimatedStyle(() => ({ transform: giroTapa(tapaAbierta.value) }));
  const estiloDentro = useAnimatedStyle(() => ({ opacity: Math.min(1, tapaAbierta.value * 2) }));
  const estiloCandado = useAnimatedStyle(() => {
    const c = candado.value;
    return {
      opacity: 1 - c,
      transform: [
        { translateY: -60 * c + 260 * c * c },
        { translateX: 30 * c },
        { rotate: `${50 * c}deg` },
      ],
    };
  });

  return (
    <View style={[st.raiz, { paddingTop: insets.top + 48, paddingBottom: Math.max(insets.bottom, 24) + 16 }]}>
      <View style={st.cabeza}>
        <Text style={st.titulo} accessibilityRole="header">
          {titulo}
        </Text>
        <Text style={[st.sub, { color }]}>{subtitulo}</Text>
      </View>

      <Pressable
        onPress={tocar}
        disabled={abierto}
        accessibilityRole="button"
        accessibilityLabel={abierto ? t('orbita.cofre.abiertoA11y', { cetis }) : t('orbita.cofre.cerradoA11y')}
        style={st.escena}
      >
        <Animated.View style={[st.cofre, estiloCofre]}>
          <Animated.View style={[st.capa, estiloTapaAbierta]}>
            <CapasCofre capas={['tapaAbierta']} size={TAM} />
          </Animated.View>
          <Animated.View style={[st.capa, estiloDentro]}>
            <CapasCofre capas={['interior', 'monedas']} size={TAM} />
          </Animated.View>
          <Animated.View style={[st.capa, estiloTapaCerrada]}>
            <CapasCofre capas={['tapaCerrada']} size={TAM} />
          </Animated.View>
          <View style={st.capa}>
            <CapasCofre capas={['cuerpo', 'franja']} size={TAM} />
          </View>
          <Animated.View style={[st.capa, estiloCandado]}>
            <CapasCofre capas={['candado']} size={TAM} />
          </Animated.View>
        </Animated.View>
        {!reducido && (
          <View pointerEvents="none" style={st.boca}>
            {Array.from({ length: MONEDAS }, (_, i) => (
              <MonedaQueSale key={i} i={i} salida={salida} />
            ))}
          </View>
        )}
      </Pressable>

      <View style={st.pie}>
        {abierto ? (
          <>
            <Animated.View entering={enterSoftScale(reducido ? 0 : 450)} style={st.premio}>
              <MonedaCeti size={34} />
              <Text style={st.premioTexto}>{t('orbita.cofre.cetis', { cetis })}</Text>
            </Animated.View>
            <Animated.View entering={enterSoftFade(reducido ? 0 : 750)} style={st.accion}>
              <TouchableOpacity
                onPress={() => montado.current && onReclamar()}
                activeOpacity={0.85}
                accessibilityRole="button"
                style={[st.boton, { backgroundColor: colors.brand.primary }]}
              >
                <Text style={[st.botonTexto, { color: colors.text.onBrand }]}>{t('orbita.cofre.reclamar')}</Text>
              </TouchableOpacity>
            </Animated.View>
          </>
        ) : (
          <View style={st.pista}>
            <Text style={st.pistaTexto}>
              {t(PISTAS[Math.min(toques, PISTAS.length - 1)])}
            </Text>
            <View style={st.puntos}>
              {Array.from({ length: TOQUES }, (_, i) => (
                <View key={i} style={[st.punto, { backgroundColor: i < toques ? ESPACIO.naranja : '#3A3A42' }]} />
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: '#0E0E11', paddingHorizontal: 24, alignItems: 'center' },
  cabeza: { alignItems: 'center', gap: 6 },
  titulo: { fontSize: 26, fontWeight: '900', color: ESPACIO.texto, textAlign: 'center' },
  sub: { fontSize: 15, fontWeight: '800', letterSpacing: 0.3, textAlign: 'center' },
  escena: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  cofre: { width: TAM, height: TAM },
  capa: { position: 'absolute', left: 0, top: 0, width: TAM, height: TAM },
  boca: { position: 'absolute', width: 0, height: 0, top: '50%', left: '50%' },
  moneda: { position: 'absolute', left: -15, top: -30 },
  pie: { minHeight: 150, width: '100%', maxWidth: 420, alignItems: 'center', justifyContent: 'flex-end', gap: 20 },
  pista: { alignItems: 'center', gap: 12, paddingBottom: 24 },
  pistaTexto: { fontSize: 16, fontWeight: '800', color: ESPACIO.textoSuave },
  puntos: { flexDirection: 'row', gap: 8 },
  punto: { width: 10, height: 10, borderRadius: 5 },
  premio: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  premioTexto: { fontSize: 34, fontWeight: '900', color: ESPACIO.oro, fontVariant: ['tabular-nums'] },
  accion: { width: '100%' },
  boton: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonTexto: { fontSize: 17, fontWeight: '900' },
});
