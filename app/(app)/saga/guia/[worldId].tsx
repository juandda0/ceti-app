/**
 * Guía del mundo: la micro-teoría del mundo, abierta desde su ficha en Tu Galaxia cuando la persona
 * quiere repasarla (en el flujo del mundo solo sale la primera vez). Solo lectura; al terminar vuelve.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useStudentGrado } from '@features/learning/hooks/useStudentGrado';
import { useClassConfig } from '@features/learning/hooks/useClassConfig';
import { microteoriaRepository } from '@features/learning/data/microteoriaRepository';
import { displayWorldDef } from '@features/learning/data/worldMeta';
import { planetaDeMundo } from '@features/learning/data/planetas';
import type { MicroteoriaBank } from '@features/learning/data/content.types';
import type { WorldId } from '@features/learning/data/quiz.types';
import MicroteoriaView from '@features/learning/components/MicroteoriaView';
import Despegue from '@features/learning/components/galaxia/Despegue';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';

export default function GuiaMundoScreen() {
  const { worldId } = useLocalSearchParams<{ worldId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const grado = useStudentGrado();
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const { config } = useClassConfig();
  const [banco, setBanco] = useState<MicroteoriaBank | null | undefined>(undefined);

  const entry = config?.mundos?.find((m) => m.worldId === worldId);
  const disp = displayWorldDef(worldId ?? '', entry);
  const posicion = Math.max(0, config?.mundos?.findIndex((m) => m.worldId === worldId) ?? 0);
  const planeta = planetaDeMundo(worldId ?? '', posicion);
  const propia = !!config?.overrides?.[worldId ?? '']?.teoria && colegioId && cursoId;

  useEffect(() => {
    if (!grado || !worldId) return;
    let vivo = true;
    void microteoriaRepository
      .fetch(grado, worldId as WorldId, propia ? { colegioId: colegioId!, cursoId: cursoId! } : null)
      .catch(() => null)
      .then((b) => {
        if (vivo) setBanco(b);
      });
    return () => {
      vivo = false;
    };
  }, [grado, worldId, propia, colegioId, cursoId]);

  const volver = () => (router.canGoBack() ? router.back() : router.replace('/saga' as never));

  if (banco === undefined) {
    return <Despegue nombre={disp?.name ?? ''} descripcion={disp?.description} planeta={planeta} />;
  }
  if (!banco || banco.cards.length === 0) {
    return (
      <View style={estilos.vacio}>
        <Ionicons name="book-outline" size={44} color={ESPACIO.textoApagado} />
        <Text style={estilos.vacioTexto}>{t('galaxia.guiaVacia')}</Text>
        <Pressable onPress={volver} accessibilityRole="button" style={estilos.boton}>
          <Text style={estilos.botonTexto}>{t('galaxia.volver')}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <MicroteoriaView
      cards={banco.cards}
      worldName={disp?.name ?? ''}
      accentColor={disp?.color ?? planeta.acento}
      onFinish={volver}
      onBack={volver}
      finishLabel={t('microteoria.terminarGuia')}
    />
  );
}

const estilos = StyleSheet.create({
  vacio: {
    flex: 1,
    backgroundColor: ESPACIO.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 32,
  },
  vacioTexto: { fontSize: 16, fontWeight: '700', color: ESPACIO.textoSuave, textAlign: 'center' },
  boton: {
    marginTop: 8,
    paddingHorizontal: 28,
    height: 50,
    borderRadius: 16,
    backgroundColor: ESPACIO.naranja,
    borderBottomWidth: 5,
    borderBottomColor: ESPACIO.naranjaOscuro,
    justifyContent: 'center',
  },
  botonTexto: { color: ESPACIO.textoSobreNaranja, fontSize: 16, fontWeight: '900', letterSpacing: 1 },
});
