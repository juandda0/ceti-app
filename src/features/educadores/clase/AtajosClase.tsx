/**
 * Fase 9 — atajos del estudiante en el espacio de su clase (Aprender): el
 * calendario de la clase y, si el profe los usa, las tareas abiertas y el
 * muro de preguntas. Solo en una clase; en Mi galaxia no aparece.
 */
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';

export interface Atajo {
  clave: string;
  icono: keyof typeof Ionicons.glyphMap;
  texto: string;
  ruta: Href;
  /** Número a la derecha (pendientes), opcional. */
  cuenta?: number;
}

export default function AtajosClase({ extra = [] }: { extra?: Atajo[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const cursoId = useAuthStore((s) => s.cursoId);
  if (role !== 'estudiante' || !cursoId) return null;
  const atajos: Atajo[] = [
    { clave: 'calendario', icono: 'calendar', texto: t('calendario.atajo'), ruta: '/(app)/calendario' as Href },
    ...extra,
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
