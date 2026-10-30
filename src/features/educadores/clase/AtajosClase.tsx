/**
 * Fase 9 — atajos del estudiante en el espacio de su clase (Aprender): el
 * calendario de la clase y, si el profe los usa, las tareas abiertas (con las
 * que le faltan) y el muro de preguntas. Solo en una clase; en Mi galaxia no
 * aparece.
 */
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';
import { tareasAbiertasRepository } from '@features/educadores/tareasAbiertas/data/tareasAbiertasRepository';
import { muroRepository } from '@features/educadores/muro/data/muroRepository';

export interface Atajo {
  clave: string;
  icono: keyof typeof Ionicons.glyphMap;
  texto: string;
  ruta: Href;
  /** Número a la derecha (pendientes), opcional. */
  cuenta?: number;
}

export default function AtajosClase() {
  const { t } = useTranslation();
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const uid = useAuthStore((s) => s.firebaseUid);
  // Tareas abiertas (cuántas le faltan) y si el profe encendió el muro.
  const [extra, setExtra] = useState<{ tareas: number | null; pendientes: number; muro: boolean }>({ tareas: null, pendientes: 0, muro: false });

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      if (role !== 'estudiante' || !colegioId || !cursoId || !uid) return;
      void (async () => {
        const [tareas, muro] = await Promise.all([
          tareasAbiertasRepository.listar(colegioId, cursoId).catch(() => []),
          muroRepository.activo(colegioId, cursoId).catch(() => false),
        ]);
        const abiertas = tareas.filter((x) => x.estado === 'abierta');
        const mias = await Promise.all(abiertas.map((x) => tareasAbiertasRepository.miEntrega(colegioId, cursoId, x.id, uid).catch(() => null)));
        if (vivo) setExtra({ tareas: tareas.length, pendientes: mias.filter((m) => !m).length, muro });
      })();
      return () => {
        vivo = false;
      };
    }, [role, colegioId, cursoId, uid])
  );

  if (role !== 'estudiante' || !cursoId) return null;
  const atajos: Atajo[] = [
    { clave: 'calendario', icono: 'calendar', texto: t('calendario.atajo'), ruta: '/(app)/calendario' as Href },
    ...(extra.tareas
      ? [{ clave: 'tareas', icono: 'create' as const, texto: t('rubricas.est.atajo'), ruta: '/(app)/tareas-abiertas' as Href, cuenta: extra.pendientes }]
      : []),
    ...(extra.muro ? [{ clave: 'muro', icono: 'chatbubbles' as const, texto: t('muro.atajo'), ruta: '/(app)/muro' as Href }] : []),
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.fila}>
      {atajos.map((a) => (
        <Bounceable
          key={a.clave}
          onPress={() => router.push(a.ruta)}
          activeScale={0.95}
          accessibilityRole="button"
          accessibilityLabel={a.texto}
          style={st.atajo}
        >
          <Ionicons name={a.icono} size={16} color={ESPACIO.oro} />
          <Text style={st.texto}>{a.texto}</Text>
          {a.cuenta ? <Text style={st.cuenta}>{a.cuenta}</Text> : null}
        </Bounceable>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  fila: { gap: 8 },
  atajo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: ESPACIO.superficie,
    borderWidth: 1,
    borderColor: ESPACIO.linea,
  },
  texto: { fontSize: 14, fontWeight: '800', color: ESPACIO.texto },
  cuenta: {
    fontSize: 12,
    fontWeight: '900',
    color: ESPACIO.textoSobreNaranja,
    backgroundColor: ESPACIO.naranja,
    borderRadius: 999,
    paddingHorizontal: 7,
    overflow: 'hidden',
  },
});
