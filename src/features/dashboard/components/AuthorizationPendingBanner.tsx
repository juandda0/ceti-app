import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';

/**
 * Ley 1581 transparency: tells a student whose roster slot is still
 * `pendiente_atestacion` that their acudiente must authorize data treatment
 * before their progress is recorded (the backend estudianteActivo gate
 * blocks progress writes until then). Renders nothing once active/suppressed or
 * for non-students.
 */
export default function AuthorizationPendingBanner() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const authUid = useAuthStore((s) => s.uid);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (role !== 'estudiante' || !colegioId || !cursoId || !authUid) {
      setPending(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const est = await rosterRepository.getEstudiante(colegioId, cursoId, authUid);
      if (!cancelled) setPending(est?.estado === 'pendiente_atestacion');
    })();
    return () => {
      cancelled = true;
    };
  }, [role, colegioId, cursoId, authUid]);

  if (!pending) return null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.background.elevated, borderColor: colors.system.orange },
      ]}
      accessibilityRole="alert"
    >
      <Ionicons name="time-outline" size={22} color={colors.system.orange} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('join.pendingTitle')}</Text>
        <Text style={[styles.body, { color: colors.text.secondary }]}>{t('join.pendingBody')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  text: { flex: 1, gap: 4 },
  title: { ...Typography.headline, fontWeight: '800' },
  body: { ...Typography.caption1, lineHeight: 18 },
});
