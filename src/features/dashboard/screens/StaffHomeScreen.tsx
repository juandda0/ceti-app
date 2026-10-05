import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PrivacyPolicyLink from '@shared/components/PrivacyPolicyLink';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { performLogoutAndGo } from '@features/auth/performLogout';
import { rosterRepository, type CursoWithId } from '@features/dashboard/data/rosterRepository';

/**
 * Landing for the profesor: the school compliance report plus their courses,
 * each linking to the course dashboard (roster + progress + export).
 */
export default function StaffHomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);
  const uid = useAuthStore((s) => s.uid);

  const [cursos, setCursos] = useState<CursoWithId[]>([]);
  const [colegioNombre, setColegioNombre] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!colegioId) return;
    let cancelled = false;
    void rosterRepository.getColegioNombre(colegioId).then((n) => {
      if (!cancelled) setColegioNombre(n);
    });
    return () => {
      cancelled = true;
    };
  }, [colegioId]);

  useEffect(() => {
    let cancelled = false;
    if (!colegioId || !uid) {
      setStatus('ready');
      return;
    }
    setStatus('loading');
    void rosterRepository
      .getCursosByProfesor(colegioId)
      .then((list) => {
        if (!cancelled) {
          setCursos(list);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [colegioId, uid]);

  const roleLabel = role ? t(`roles.${role}`) : '';

  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24 }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('staff.homeTitle')}</Text>
        <Text style={[styles.welcome, { color: colors.text.secondary }]}>
          {t('staff.welcome', { role: roleLabel })}
        </Text>

        <View style={[styles.card, { backgroundColor: colors.background.secondary }]}>
          <Text style={[styles.cardLabel, { color: colors.text.secondary }]}>
            {t('staff.colegioLabel')}
          </Text>
          <Text style={[styles.cardValue, { color: colors.text.primary }]}>
            {colegioNombre ?? '…'}
          </Text>
        </View>

        {/* profesor: aggregated school compliance report (non-nominal, D-PIVOT). */}
        {role === 'profesor' && (
          <TouchableOpacity
            style={[styles.courseRow, { borderColor: colors.brand.primary }]}
            accessibilityRole="button"
            onPress={() => router.push('/(staff)/colegio' as Href)}
          >
            <Ionicons name="stats-chart-outline" size={20} color={colors.brand.primary} />
            <View style={styles.courseInfo}>
              <Text style={[styles.courseName, { color: colors.text.primary }]}>
                {t('school.reportLink')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
          </TouchableOpacity>
        )}

        <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>
          {t('staff.coursesLabel')}
        </Text>

        {status === 'loading' && (
          <ActivityIndicator style={styles.loader} color={colors.brand.primary} />
        )}
        {status === 'error' && (
          <Text style={[styles.note, { color: colors.text.secondary }]}>
            {t('dashboard.error')}
          </Text>
        )}
        {status === 'ready' && cursos.length === 0 && (
          <Text style={[styles.note, { color: colors.text.secondary }]}>
            {t('staff.noCourses')}
          </Text>
        )}
        {cursos.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.courseRow, { borderColor: colors.background.secondary }]}
            accessibilityRole="button"
            onPress={() =>
              router.push(`/(staff)/curso/${c.id}?nombre=${encodeURIComponent(c.nombre)}` as Href)
            }
          >
            <Ionicons name="people-outline" size={20} color={colors.brand.primary} />
            <View style={styles.courseInfo}>
              <Text style={[styles.courseName, { color: colors.text.primary }]}>{c.nombre}</Text>
              <Text style={[styles.courseGrade, { color: colors.text.tertiary }]}>{c.grado}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
          </TouchableOpacity>
        ))}

        {/* Professor creates their own classes (D-ADMIN / RQ-PR13). */}
        {status === 'ready' && (
          <TouchableOpacity
            style={[styles.createRow, { borderColor: colors.brand.primary }]}
            accessibilityRole="button"
            onPress={() => router.push('/(staff)/crear-clase' as Href)}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.brand.primary} />
            <Text style={[styles.createText, { color: colors.brand.primary }]}>
              {t('createClass.create')}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.logout, { borderColor: colors.brand.primary }]}
          onPress={() => void performLogoutAndGo(router, '/(auth)/welcome')}
          accessibilityRole="button"
        >
          <Text style={[styles.logoutText, { color: colors.brand.primary }]}>
            {t('staff.logout')}
          </Text>
        </TouchableOpacity>

        <PrivacyPolicyLink style={styles.policy} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 48, gap: 14 },
  title: { fontSize: 26, fontWeight: '800' },
  welcome: { fontSize: 16 },
  card: { borderRadius: 16, padding: 16, gap: 4 },
  cardLabel: { fontSize: 13, fontWeight: '600' },
  cardValue: { fontSize: 18, fontWeight: '700' },
  sectionLabel: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  loader: { marginTop: 8 },
  note: { fontSize: 14, lineHeight: 20 },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  courseInfo: { flex: 1, gap: 2 },
  courseName: { fontSize: 15, fontWeight: '600' },
  courseGrade: { fontSize: 12 },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
  },
  createText: { fontSize: 15, fontWeight: '700' },
  logout: {
    marginTop: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { fontSize: 16, fontWeight: '700' },
  policy: { marginTop: 8 },
});
