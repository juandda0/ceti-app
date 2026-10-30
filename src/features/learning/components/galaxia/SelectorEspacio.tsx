/**
 * Selector de espacio en Aprender: "Mi galaxia" y una píldora por clase. Solo
 * aparece si el estudiante está en alguna clase. Lo que hace en el espacio de
 * una clase lo ve su profe; lo de su galaxia es solo suyo.
 */
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Bounceable from '@shared/components/Bounceable';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useMisClases } from '@features/dashboard/hooks/useMiClase';
import { ESPACIO } from './espacio';

export default function SelectorEspacio() {
  const { t } = useTranslation();
  const espacio = useAuthStore((s) => s.espacio);
  const setEspacio = useAuthStore((s) => s.setEspacio);
  const { clases } = useMisClases();

  if (clases.length === 0) return null;

  const opciones = [
    { id: null as string | null, nombre: t('espacios.miGalaxia'), icono: 'planet' as const },
    ...clases.map((c) => ({
      id: c.cursoId as string | null,
      nombre: c.nombre || t('miClase.tuClase'),
      icono: 'school' as const,
    })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={st.fila}
      accessibilityRole="tablist"
    >
      {opciones.map((o) => {
        const activo = o.id === espacio;
        return (
          <Bounceable
            key={o.id ?? 'mi-galaxia'}
            onPress={() => {
              if (activo) return;
              void Haptics.selectionAsync();
              setEspacio(o.id);
            }}
            activeScale={0.95}
            accessibilityRole="tab"
            accessibilityState={{ selected: activo }}
            accessibilityLabel={o.nombre}
            style={[st.pildora, activo ? st.pildoraActiva : null]}
          >
            <Ionicons
              name={o.icono}
              size={16}
              color={activo ? ESPACIO.textoSobreNaranja : ESPACIO.textoSuave}
            />
            <Text style={[st.texto, activo ? st.textoActivo : null]} numberOfLines={1}>
              {o.nombre}
            </Text>
          </Bounceable>
        );
      })}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  fila: { gap: 8, paddingHorizontal: 20 },
  pildora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: ESPACIO.superficie,
    borderWidth: 1,
    borderColor: ESPACIO.linea,
    maxWidth: 220,
  },
  pildoraActiva: { backgroundColor: ESPACIO.naranja, borderColor: ESPACIO.naranja },
  texto: { fontSize: 14, fontWeight: '800', color: ESPACIO.textoSuave },
  textoActivo: { color: ESPACIO.textoSobreNaranja },
});
