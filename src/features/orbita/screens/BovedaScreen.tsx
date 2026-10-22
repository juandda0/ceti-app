/**
 * La Bóveda de Ceti: dónde viven los Cetis. Saldo e interés de los lunes, Ceti
 * comentando, mover entre bolsillo y Bóveda, CDT orbital, escudos de racha,
 * la inflación de Saturno y una proyección de 8 semanas.
 *
 * `uid` solo lo pasa la ruta de desarrollo; en la app es el uid de juego.
 */
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import BackButton from '@shared/components/BackButton';
import { enterFadeUp } from '@shared/constants/motion';
import { ESPACIO, FondoEstrellas } from '@features/learning/components/galaxia/espacio';
import { useUidJuego } from '@features/orbita/hooks/useOrbita';
import { useOrbitaStore } from '@features/orbita/store/useOrbitaStore';
import { dayKey } from '@features/orbita/domain/tiempo';
import Saldo from '@features/orbita/components/boveda/Saldo';
import BurbujaCeti from '@features/orbita/components/boveda/BurbujaCeti';
import MoverCetis from '@features/orbita/components/boveda/MoverCetis';
import CdtOrbital from '@features/orbita/components/boveda/CdtOrbital';
import EscudosBoveda from '@features/orbita/components/boveda/EscudosBoveda';
import InflacionSaturno from '@features/orbita/components/boveda/InflacionSaturno';
import Proyeccion from '@features/orbita/components/boveda/Proyeccion';

const ANCHO_MAX = 560;

export default function BovedaScreen({ uid: uidForzado }: { uid?: string }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const uidJuego = useUidJuego();
  const uid = uidForzado ?? uidJuego;
  const estado = useOrbitaStore((s) => (uid ? s.porUid[uid] : undefined));
  const hoy = dayKey(Date.now());

  useEffect(() => {
    if (uid && !estado) useOrbitaStore.getState().asegurar(uid);
  }, [uid, estado]);

  return (
    <View style={st.raiz}>
      <FondoEstrellas ancho={width} alto={height} />
      <View style={[st.barraTop, { paddingTop: insets.top + 8 }]}>
        <View style={st.ancho}>
          <BackButton fallback="/" color={ESPACIO.textoSuave} />
          <Text style={st.titulo} accessibilityRole="header">
            {t('orbita.boveda.titulo')}
          </Text>
        </View>
      </View>

      {estado ? (
        <ScrollView
          contentContainerStyle={[st.contenido, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[st.ancho, st.secciones]}>
            <Animated.View entering={enterFadeUp(0)}>
              <Saldo boveda={estado.boveda} hoy={hoy} />
            </Animated.View>
            <Animated.View entering={enterFadeUp(1)}>
              <BurbujaCeti boveda={estado.boveda} hoy={hoy} />
            </Animated.View>
            <Animated.View entering={enterFadeUp(2)}>
              <MoverCetis uid={uid} boveda={estado.boveda} />
            </Animated.View>
            <Animated.View entering={enterFadeUp(3)}>
              <CdtOrbital uid={uid} boveda={estado.boveda} hoy={hoy} />
            </Animated.View>
            <Animated.View entering={enterFadeUp(4)}>
              <Proyeccion boveda={estado.boveda} />
            </Animated.View>
            <Animated.View entering={enterFadeUp(5)}>
              <InflacionSaturno hoy={hoy} />
            </Animated.View>
            <Animated.View entering={enterFadeUp(6)}>
              <EscudosBoveda
                uid={uid}
                escudos={estado.racha.escudos}
                bolsillo={estado.boveda.bolsillo}
                boveda={estado.boveda.boveda}
                hoy={hoy}
              />
            </Animated.View>
            <Text style={st.pie}>{t('orbita.boveda.pie')}</Text>
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: ESPACIO.fondo },
  barraTop: { paddingHorizontal: 16, paddingBottom: 6 },
  ancho: { width: '100%', maxWidth: ANCHO_MAX, alignSelf: 'center' },
  titulo: { color: ESPACIO.texto, fontSize: 22, fontWeight: '900', marginTop: 4 },
  contenido: { paddingHorizontal: 16, paddingTop: 8 },
  secciones: { gap: 16 },
  pie: {
    color: ESPACIO.textoApagado,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 12,
  },
});
