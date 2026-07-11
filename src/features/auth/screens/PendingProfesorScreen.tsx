/**
 * PendingProfesorScreen (D-ADMIN) — a user who declared "profesor" but whose
 * email is NOT pre-authorized by an admin lands here. No access until an admin
 * authorizes their email (RQ-AD08). They can retry (re-resolve after being
 * authorized) or switch account.
 */
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { performLogoutAndGo } from '@features/auth/performLogout';

export default function PendingProfesorScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const email = getFirebaseClients()?.auth.currentUser?.email ?? '';

  // Retry: re-run the resolver (the admin may have just authorized this email).
  const onRetry = () => {
    setBusy(true);
    router.replace('/');
  };

  return (
    <ScreenWrapper style={{ flex: 1, backgroundColor: colors.background.base }}>
      <View style={styles.wrap}>
        <View style={[styles.iconCircle, { backgroundColor: colors.system.orange + '22' }]}>
          <Ionicons name="hourglass-outline" size={30} color={colors.system.orange} />
        </View>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          {t('pendingProfesor.title')}
        </Text>
        <Text style={[styles.body, { color: colors.text.secondary }]}>
          {t('pendingProfesor.body', { email })}
        </Text>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.brand.primary, opacity: busy ? 0.6 : 1 }]}
          onPress={onRetry}
          disabled={busy}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>{t('pendingProfesor.retry')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => void performLogoutAndGo(router)}
          accessibilityRole="button"
          style={styles.logout}
        >
          <Text style={[styles.logoutText, { color: colors.text.tertiary }]}>
            {t('pendingProfesor.wrongAccount')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 14 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '900', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 420 },
  btn: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  logout: { marginTop: 4, paddingVertical: 8 },
  logoutText: { fontSize: 13, fontWeight: '600' },
});
