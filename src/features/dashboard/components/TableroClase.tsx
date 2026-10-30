/**
 * Fase 5 — "Tu profe dice" en Aprender, solo en el espacio de una clase: el
 * último mensaje del profe (o su último anuncio) y cuántos hay sin ver. Lleva a
 * los mensajes de la clase. En Mi galaxia, sin autorización o sin nada que
 * mostrar, no renderiza nada.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';
import { avisosRepository, sinLeer } from '@features/dashboard/data/avisosRepository';
import { comunicacionRepository } from '@features/dashboard/data/comunicacionRepository';

const DIA_MS = 24 * 60 * 60 * 1000;
/** Un anuncio ya visto sigue a la vista dos semanas. */
const ANUNCIO_VIGENTE_MS = 14 * DIA_MS;

export function rutaMensajesClase(colegioId: string, cursoId: string): Href {
  return `/(app)/mensajes?colegioId=${encodeURIComponent(colegioId)}&cursoId=${encodeURIComponent(cursoId)}` as Href;
}

export default function TableroClase() {
  const { t } = useTranslation();
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const uid = useAuthStore((s) => s.firebaseUid);
  const [resumen, setResumen] = useState<{ texto: string; nuevos: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      if (role !== 'estudiante' || !colegioId || !cursoId || !uid) {
        setResumen(null);
        return;
      }
      void Promise.all([
        avisosRepository.mios(uid).catch(() => []),
        comunicacionRepository.anuncios(colegioId, cursoId).catch(() => []),
      ]).then(([avisos, anuncios]) => {
        if (cancelado) return;
        const nuevos = sinLeer(avisos, cursoId).filter((a) => a.tipo !== 'alerta');
        const anuncio = anuncios[0];
        const vigente = anuncio && Date.now() - anuncio.creadoAt < ANUNCIO_VIGENTE_MS;
        const texto = nuevos[0]?.cuerpo ?? (vigente ? anuncio.texto : null);
        setResumen(texto ? { texto, nuevos: nuevos.length } : null);
      });
      return () => {
        cancelado = true;
      };
    }, [role, colegioId, cursoId, uid])
  );

  if (!resumen || !colegioId || !cursoId) return null;

  return (
    <Bounceable
      onPress={() => router.push(rutaMensajesClase(colegioId, cursoId))}
      activeScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={t('comunicacion.tableroA11y', { count: resumen.nuevos })}
      style={st.wrap}
    >
      <View style={st.cabeza}>
        <Ionicons name="megaphone" size={16} color={ESPACIO.oro} />
        <Text style={st.titulo}>{t('comunicacion.tuProfeDice')}</Text>
        {resumen.nuevos > 0 ? (
          <View style={st.pill}>
            <Text style={st.pillTexto}>{t('comunicacion.nuevos', { count: resumen.nuevos })}</Text>
          </View>
        ) : null}
      </View>
      <Text style={st.texto} numberOfLines={2}>
        {resumen.texto}
      </Text>
      <View style={st.cabeza}>
        <Text style={st.ver}>{t('comunicacion.verMensajes')}</Text>
        <Ionicons name="chevron-forward" size={14} color={ESPACIO.textoSuave} />
      </View>
    </Bounceable>
  );
}

const st = StyleSheet.create({
  wrap: {
    borderRadius: 20,
    padding: 14,
    gap: 6,
    backgroundColor: ESPACIO.superficie,
    borderWidth: 1,
    borderColor: ESPACIO.linea,
  },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titulo: { flex: 1, fontSize: 15, fontWeight: '900', color: ESPACIO.texto },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: ESPACIO.naranja },
  pillTexto: { fontSize: 12, fontWeight: '900', color: ESPACIO.textoSobreNaranja },
  texto: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: ESPACIO.texto },
  ver: { fontSize: 13, fontWeight: '800', color: ESPACIO.textoSuave },
});
