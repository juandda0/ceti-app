/** Fase 8c — en Clases: la entrada a la biblioteca pública de mundos. */
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { paletaTono } from '@features/dashboard/components/profe/kit';

export default function BibliotecaPublicaAcceso() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const p = paletaTono(colors, 'azul');
  return (
    <Bounceable
      onPress={() => router.push('/(staff)/biblioteca-publica' as Href)}
      activeScale={0.97}
      accessibilityRole="button"
      accessibilityLabel={t('diferenciales.biblioteca.titulo')}
      style={[st.acceso, { backgroundColor: colors.materials.base, borderColor: colors.materials.border }]}
    >
      <View style={[st.icono, { backgroundColor: p.fondo }]}>
        <Ionicons name="globe-outline" size={20} color={p.tinta} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[st.titulo, { color: colors.text.primary }]}>{t('diferenciales.biblioteca.titulo')}</Text>
        <Text style={[st.texto, { color: colors.text.tertiary }]} numberOfLines={2}>
          {t('diferenciales.biblioteca.acceso')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.text.quaternary} />
    </Bounceable>
  );
}

const st = StyleSheet.create({
  acceso: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 20, padding: 14 },
  icono: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 15, fontWeight: '900' },
  texto: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
});
