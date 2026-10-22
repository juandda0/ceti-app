/**
 * Despegue: lo que se ve mientras carga un mundo (reemplaza el spinner). El planeta del mundo grande,
 * "Despegando hacia…", una barra de carga y de qué trata el mundo. Con `duracion` la barra se llena en
 * ese tiempo (la pantalla dura a propósito para que se alcance a leer); sin ella, va y viene.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CetiAnimation } from '@features/animations';
import type { Planeta } from '@features/learning/data/planetas';
import { ESPACIO, FondoEstrellas } from './espacio';

const ANCHO_BARRA = 270;

export default function Despegue({
  nombre,
  descripcion,
  planeta,
  duracion,
}: {
  nombre: string;
  descripcion?: string;
  planeta: Planeta;
  /** ms en que la barra se llena una vez. */
  duracion?: number;
}) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const reducir = useReducedMotion();
  const avance = useSharedValue(0);

  useEffect(() => {
    if (duracion) {
      avance.value = reducir ? 1 : withTiming(1, { duration: duracion, easing: Easing.out(Easing.quad) });
      return;
    }
    if (reducir) return;
    avance.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [avance, reducir, duracion]);

  const relleno = useAnimatedStyle(() =>
    duracion
      ? { width: 14 + avance.value * (ANCHO_BARRA - 14) }
      : { width: ANCHO_BARRA * 0.4, transform: [{ translateX: avance.value * (ANCHO_BARRA * 0.6) }] }
  );

  const tam = Math.min(280, width * 0.7);

  return (
    <View style={estilos.raiz} accessibilityLiveRegion="polite">
      <FondoEstrellas ancho={width} alto={height} />
      <CetiAnimation id={planeta.animacion} size={tam} />
      <View style={estilos.textos}>
        <Text style={[estilos.etiqueta, { color: planeta.acento }]}>{t('galaxia.despegandoHacia')}</Text>
        <Text style={estilos.nombre}>{nombre}</Text>
      </View>
      <View
        style={estilos.barra}
        accessibilityRole="progressbar"
        accessibilityLabel={t('saga.loading')}
      >
        <Animated.View style={[estilos.barraRelleno, { backgroundColor: planeta.acento }, relleno]} />
      </View>
      {descripcion ? (
        <View style={estilos.tarjeta}>
          <View style={estilos.tarjetaIcono}>
            <Ionicons name="bulb-outline" size={20} color={ESPACIO.textoSobreNaranja} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={estilos.tarjetaEtiqueta}>{t('galaxia.enEsteMundo')}</Text>
            <Text style={estilos.tarjetaTexto}>{descripcion}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: {
    flex: 1,
    backgroundColor: ESPACIO.fondoProfundo,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 18,
  },
  textos: { alignItems: 'center', gap: 4 },
  etiqueta: { fontSize: 14, fontWeight: '900', letterSpacing: 1.6 },
  nombre: { fontSize: 30, lineHeight: 34, fontWeight: '900', color: ESPACIO.texto, textAlign: 'center' },
  barra: {
    width: ANCHO_BARRA,
    height: 14,
    borderRadius: 7,
    backgroundColor: ESPACIO.boton,
    overflow: 'hidden',
  },
  barraRelleno: { height: '100%', borderRadius: 7 },
  tarjeta: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 18,
    backgroundColor: ESPACIO.superficie,
    borderBottomWidth: 4,
    borderBottomColor: ESPACIO.sombra,
    marginTop: 10,
  },
  tarjetaIcono: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: ESPACIO.naranja,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tarjetaEtiqueta: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2, color: '#FF9F45' },
  tarjetaTexto: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: ESPACIO.texto },
});
