/**
 * Fase 8a — en Aprender, en el espacio de una clase: «Tu profe abrió una clase
 * en vivo» mientras haya una sesión sin terminar. Escucha en tiempo real, así
 * aparece apenas el profe la abre. En Mi galaxia, nada.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';
import type { SesionVivo } from '@/functions/src/educadores/dominio';
import { vivoRepository } from '../data/vivoRepository';

export default function VivoAbierta() {
  const { t } = useTranslation();
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const [sesion, setSesion] = useState<SesionVivo | null>(null);

  useEffect(() => {
    if (role !== 'estudiante' || !colegioId || !cursoId) return setSesion(null);
    try {
      return vivoRepository.escuchar(colegioId, cursoId, setSesion, () => setSesion(null));
    } catch {
      setSesion(null);
    }
  }, [role, colegioId, cursoId]);

  if (!sesion || sesion.estado === 'terminada') return null;

  return (
    <Bounceable
      onPress={() => router.push('/(app)/vivo' as Href)}
      activeScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={t('diferenciales.vivo.aviso')}
      style={st.wrap}
    >
      <View style={st.cabeza}>
        <Ionicons name="radio" size={16} color={ESPACIO.naranja} />
        <Text style={st.titulo}>{t('diferenciales.vivo.aviso')}</Text>
      </View>
      <Text style={st.texto}>{t('diferenciales.vivo.avisoTexto', { mundo: sesion.titulo })}</Text>
      <View style={st.cabeza}>
        <Text style={st.ver}>{t('diferenciales.vivo.entrar')}</Text>
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
    borderWidth: 2,
    borderColor: ESPACIO.naranja,
  },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titulo: { flex: 1, fontSize: 15, fontWeight: '900', color: ESPACIO.texto },
  texto: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: ESPACIO.texto },
  ver: { fontSize: 13, fontWeight: '800', color: ESPACIO.textoSuave },
});
