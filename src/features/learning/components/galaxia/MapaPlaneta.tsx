/**
 * Mapa de un planeta: los niveles en zigzag, de abajo hacia arriba como un
 * camino de despegue. Lecciones primero y el jefe al final. El nodo actual
 * late y lleva el globo "EMPEZAR"; los hechos se pueden repetir.
 */
import { useEffect } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CetiAnimation } from '@features/animations';
import { ESPACIO, FondoEstrellas } from '@features/learning/components/galaxia/espacio';
import type { Planeta } from '@features/learning/data/planetas';
import type { NodoMapa } from '@features/orbita/domain/niveles';
import PuenteDeMando from '@features/orbita/components/PuenteDeMando';

const NODO = 74;
const NODO_JEFE = 96;
const PASO = 104;
const AMPLITUD = 72;

function Nodo({
  nodo,
  planeta,
  onPress,
  etiqueta,
}: {
  nodo: NodoMapa;
  planeta: Planeta;
  onPress: () => void;
  etiqueta: string;
}) {
  const jefe = nodo.tipo === 'jefe';
  const tam = jefe ? NODO_JEFE : NODO;
  const actual = nodo.estado === 'actual';
  const hecho = nodo.estado === 'hecho';
  const bloqueado = nodo.estado === 'bloqueado';

  const pulso = useSharedValue(1);
  useEffect(() => {
    if (!actual) return;
    pulso.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 900, reduceMotion: ReduceMotion.System }),
        withTiming(1, { duration: 900, reduceMotion: ReduceMotion.System })
      ),
      -1
    );
  }, [actual, pulso]);
  const anillo = useAnimatedStyle(() => ({ transform: [{ scale: pulso.value }] }));

  const fondo = bloqueado ? ESPACIO.boton : hecho ? ESPACIO.oro : planeta.acento;
  const sombra = bloqueado ? ESPACIO.sombra : hecho ? '#B8892A' : planeta.acentoOscuro;
  const icono: keyof typeof Ionicons.glyphMap = bloqueado
    ? 'lock-closed'
    : jefe
      ? hecho
        ? 'trophy'
        : 'skull'
      : hecho
        ? 'checkmark'
        : 'star';

  return (
    <View style={{ width: tam + 24, alignItems: 'center' }}>
      {actual && (
        <Animated.View
          pointerEvents="none"
          style={[
            st.anillo,
            { width: tam + 18, height: tam + 18, borderRadius: (tam + 18) / 2, borderColor: planeta.acento },
            anillo,
          ]}
        />
      )}
      <TouchableOpacity
        onPress={onPress}
        disabled={bloqueado}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={etiqueta}
        accessibilityState={{ disabled: bloqueado }}
        style={[
          st.nodo,
          {
            width: tam,
            height: tam,
            borderRadius: tam / 2,
            backgroundColor: fondo,
            borderBottomColor: sombra,
          },
        ]}
      >
        <Ionicons
          name={icono}
          size={jefe ? 40 : 32}
          color={bloqueado ? ESPACIO.textoApagado : ESPACIO.textoSobreNaranja}
        />
      </TouchableOpacity>
    </View>
  );
}

export default function MapaPlaneta({
  nombre,
  planeta,
  nodos,
  totalLecciones,
  onNodo,
  onVolver,
  onGuia,
}: {
  nombre: string;
  planeta: Planeta;
  nodos: NodoMapa[];
  totalLecciones: number;
  onNodo: (nodo: NodoMapa) => void;
  onVolver: () => void;
  onGuia: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const hechos = nodos.filter((n) => n.estado === 'hecho').length;
  // De abajo hacia arriba: el primer nivel queda al fondo, cerca del pulgar.
  const enOrden = [...nodos].reverse();
  const actualIdx = nodos.findIndex((n) => n.estado === 'actual');

  const etiquetaDe = (n: NodoMapa) =>
    n.tipo === 'jefe'
      ? t('orbita.mapa.jefe')
      : t('orbita.mapa.leccion', { n: n.indice + 1, total: totalLecciones });

  return (
    <View style={[st.raiz, { width }]}>
      <FondoEstrellas ancho={width} alto={height} />
      <View
        style={[st.cabecera, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 8) + 8 }]}
      >
        <TouchableOpacity
          onPress={onVolver}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('galaxia.volver')}
          style={st.icono}
        >
          <Ionicons name="chevron-back" size={24} color={ESPACIO.texto} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[st.titulo]} numberOfLines={1} accessibilityRole="header">
            {nombre}
          </Text>
          <Text style={[st.sub, { color: planeta.acento }]}>
            {t('orbita.mapa.progreso', { hechos, total: nodos.length })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onGuia}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('galaxia.leerGuia')}
          style={st.icono}
        >
          <Ionicons name="book-outline" size={22} color={ESPACIO.texto} />
        </TouchableOpacity>
      </View>
      <View style={st.puente}>
        <PuenteDeMando compacto />
      </View>

      <ScrollView
        contentContainerStyle={[st.camino, { paddingBottom: Math.max(insets.bottom, 24) + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={st.planeta}>
          <CetiAnimation id={planeta.animacion} size={120} />
        </View>
        {enOrden.map((n) => {
          // Zigzag suave: cada nivel se corre a un lado siguiendo una onda.
          const x = Math.sin(n.indice * 1.1) * AMPLITUD;
          const actual = n.estado === 'actual';
          return (
            <View key={`${n.tipo}-${n.indice}`} style={[st.fila, { height: PASO, transform: [{ translateX: x }] }]}>
              {actual && (
                <View style={[st.globo, { backgroundColor: ESPACIO.superficie, borderColor: planeta.acento }]}>
                  <Text style={[st.globoTexto, { color: planeta.acento }]}>
                    {n.indice === 0 && actualIdx === 0 ? t('galaxia.empezar') : t('galaxia.continuar')}
                  </Text>
                </View>
              )}
              <Nodo
                nodo={n}
                planeta={planeta}
                etiqueta={etiquetaDe(n)}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onNodo(n);
                }}
              />
              {n.tipo === 'jefe' && (
                <Text style={[st.jefeTexto, { color: n.estado === 'bloqueado' ? ESPACIO.textoApagado : ESPACIO.oro }]}>
                  {t('orbita.mapa.jefeCorto')}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: ESPACIO.fondo, overflow: 'hidden' },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 6 },
  icono: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 22, fontWeight: '900', color: ESPACIO.texto },
  sub: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  puente: { paddingHorizontal: 16, paddingBottom: 4 },
  camino: { alignItems: 'center', paddingTop: 8 },
  planeta: { alignItems: 'center', marginBottom: 4, opacity: 0.95 },
  fila: { alignItems: 'center', justifyContent: 'center' },
  nodo: {
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 6,
  },
  anillo: { position: 'absolute', borderWidth: 3, top: -9, left: 3 },
  globo: {
    position: 'absolute',
    top: -22,
    zIndex: 2,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  globoTexto: { fontSize: 13, fontWeight: '900', letterSpacing: 0.6 },
  jefeTexto: { fontSize: 12, fontWeight: '900', letterSpacing: 1, marginTop: 4 },
});
