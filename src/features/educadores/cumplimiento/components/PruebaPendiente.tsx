/**
 * Fase 7 — en Aprender, en el espacio de una clase: "Tu profe abrió la prueba
 * de entrada (o de salida)" mientras la fase esté abierta y el estudiante no la
 * haya hecho. Lleva a la prueba. En Mi galaxia o sin nada pendiente, nada.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';
import { FASES_PRUEBA, faseAbierta, type FasePrueba } from '@/functions/src/educadores/dominio';
import { cumplimientoRepository } from '../data/cumplimientoRepository';

export default function PruebaPendiente() {
  const { t } = useTranslation();
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const uid = useAuthStore((s) => s.firebaseUid);
  const [fase, setFase] = useState<FasePrueba | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      if (role !== 'estudiante' || !colegioId || !cursoId || !uid) {
        setFase(null);
        return;
      }
      void (async () => {
        try {
          const config = await cumplimientoRepository.configPrueba(colegioId, cursoId);
          for (const f of FASES_PRUEBA) {
            if (!faseAbierta(config, f)) continue;
            const hecha = await cumplimientoRepository.miResultado(colegioId, cursoId, uid, f);
            if (!hecha) {
              if (!cancelado) setFase(f);
              return;
            }
          }
          if (!cancelado) setFase(null);
        } catch {
          if (!cancelado) setFase(null);
        }
      })();
      return () => {
        cancelado = true;
      };
    }, [role, colegioId, cursoId, uid])
  );

  if (!fase) return null;

  return (
    <Bounceable
      onPress={() => router.push(`/(app)/prueba?fase=${fase}` as Href)}
      activeScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={t(`cumplimiento.estudiante.aviso_${fase}`)}
      style={st.wrap}
    >
      <View style={st.cabeza}>
        <Ionicons name="clipboard" size={16} color={ESPACIO.naranja} />
        <Text style={st.titulo}>{t(`cumplimiento.estudiante.aviso_${fase}`)}</Text>
      </View>
      <Text style={st.texto}>{t('cumplimiento.estudiante.avisoTexto')}</Text>
      <View style={st.cabeza}>
        <Text style={st.ver}>{t('cumplimiento.estudiante.empezar')}</Text>
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
    borderColor: ESPACIO.naranja,
  },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titulo: { flex: 1, fontSize: 15, fontWeight: '900', color: ESPACIO.texto },
  texto: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: ESPACIO.texto },
  ver: { fontSize: 13, fontWeight: '800', color: ESPACIO.textoSuave },
});
