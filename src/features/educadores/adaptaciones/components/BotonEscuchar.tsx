/**
 * Fase 8c — botón «Escuchar»: lee en voz alta el texto que recibe. Se muestra
 * solo con la adaptación «leer en voz alta» (o en 1° a 3°).
 */
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { callar, leer } from '../data/voz';

export default function BotonEscuchar({ texto, oscuro = false }: { texto: string; oscuro?: boolean }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  // Al cambiar de pregunta o salir, se calla.
  useEffect(() => () => callar(), [texto]);
  return (
    <Bounceable
      onPress={() => leer(texto)}
      activeScale={0.94}
      accessibilityRole="button"
      accessibilityLabel={t('diferenciales.adaptaciones.escuchar')}
      style={[st.boton, { backgroundColor: oscuro ? '#ffffff1f' : colors.fill.brandSubtle }]}
    >
      <Ionicons name="volume-high" size={16} color={oscuro ? '#F2F2F4' : colors.brand.primary} />
      <Text style={[st.texto, { color: oscuro ? '#F2F2F4' : colors.text.primary }]}>{t('diferenciales.adaptaciones.escuchar')}</Text>
    </Bounceable>
  );
}

const st = StyleSheet.create({
  boton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  texto: { fontSize: 14, fontWeight: '800' },
});
