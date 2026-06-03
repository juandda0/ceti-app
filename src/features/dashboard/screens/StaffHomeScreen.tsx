import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PrivacyPolicyLink from '@shared/components/PrivacyPolicyLink';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { performLogoutAndGo } from '@features/auth/performLogout';

/**
 * Landing for school staff (rector/coordinador/profesor). Placeholder for the
 * teacher dashboard (roster + per-student progress + CSV/PDF), built in F6.
 */
export default function StaffHomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);

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
          <Text style={[styles.cardValue, { color: colors.text.primary }]}>{colegioId ?? '—'}</Text>
        </View>

        <View style={[styles.soonRow, { borderColor: colors.background.secondary }]}>
          <Ionicons name="bar-chart-outline" size={20} color={colors.brand.primary} />
          <Text style={[styles.soon, { color: colors.text.secondary }]}>
            {t('staff.dashboardSoon')}
          </Text>
        </View>

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
  scroll: { paddingHorizontal: 24, paddingBottom: 48, gap: 16 },
  title: { fontSize: 26, fontWeight: '800' },
  welcome: { fontSize: 16 },
  card: { borderRadius: 16, padding: 16, gap: 4 },
  cardLabel: { fontSize: 13, fontWeight: '600' },
  cardValue: { fontSize: 18, fontWeight: '700' },
  soonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  soon: { flex: 1, fontSize: 14, lineHeight: 20 },
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
