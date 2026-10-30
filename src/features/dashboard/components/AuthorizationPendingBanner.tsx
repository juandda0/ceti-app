import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';
import { useMiClase } from '@features/dashboard/hooks/useMiClase';

/**
 * Ley 1581 transparency: tells a student whose roster slot is still
 * `pendiente_atestacion` that their teacher must confirm the acudiente
 * authorization before their progress reaches the class (the firestore.rules
 * estudianteActivo gate blocks progress writes until then). Renders nothing
 * once active, without a class, or for non-students. Styled for Aprender.
 */
export default function AuthorizationPendingBanner() {
  const { t } = useTranslation();
  const { clase } = useMiClase();

  if (clase?.estado !== 'pendiente_atestacion') return null;

  return (
    <View style={st.card} accessibilityRole="alert">
      <Ionicons name="time-outline" size={22} color={ESPACIO.oro} />
      <View style={st.text}>
        <Text style={st.title}>{t('join.pendingTitle')}</Text>
        <Text style={st.body}>{t('join.pendingBody')}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1.5,
    borderColor: ESPACIO.oro,
    borderRadius: 20,
    padding: 14,
    backgroundColor: ESPACIO.superficie,
  },
  text: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '900', color: ESPACIO.texto },
  body: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: ESPACIO.textoSuave },
});
