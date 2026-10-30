/**
 * Fase 5 — en la pestaña Clases: cuántas alertas nuevas tiene el profe y la
 * más reciente. Lleva a Avisos. Sin alertas no renderiza nada.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { avisosRepository, sinLeer, type Aviso } from '@features/dashboard/data/avisosRepository';
import { Pill, Tarjeta, paletaTono } from '@features/dashboard/components/profe/kit';
import { Ionicons } from '@expo/vector-icons';

export default function AvisosTarjeta() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const uid = useAuthStore((s) => s.firebaseUid);
  const [alertas, setAlertas] = useState<Aviso[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      if (!uid) return;
      void avisosRepository
        .mios(uid)
        .then((l) => {
          if (!cancelado) setAlertas(l.filter((a) => a.tipo === 'alerta'));
        })
        .catch(() => undefined);
      return () => {
        cancelado = true;
      };
    }, [uid])
  );

  if (alertas.length === 0) return null;
  const nuevas = sinLeer(alertas);
  const tono = paletaTono(colors, nuevas.length > 0 ? 'naranja' : 'neutro');

  return (
    <Tarjeta
      onPress={() => router.push('/(staff)/avisos' as Href)}
      accessibilityLabel={t('avisos.abrir', { count: nuevas.length })}
    >
      <View style={st.fila}>
        <View style={[st.icono, { backgroundColor: tono.fondo }]}>
          <Ionicons name="notifications" size={22} color={tono.tinta} />
        </View>
        <View style={st.textos}>
          <Text style={[st.titulo, { color: colors.text.primary }]}>{t('avisos.titulo')}</Text>
          <Text style={[st.sub, { color: colors.text.secondary }]} numberOfLines={2}>
            {(nuevas[0] ?? alertas[0]).titulo}
          </Text>
        </View>
        {nuevas.length > 0 ? (
          <Pill tono="naranja" texto={t('avisos.nuevos', { count: nuevas.length })} />
        ) : null}
      </View>
    </Tarjeta>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icono: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, gap: 2 },
  titulo: { fontSize: 16, fontWeight: '900' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
