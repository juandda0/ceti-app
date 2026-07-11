/**
 * JoinClassScreen — the student access gate (D-ADMIN / RQ-FN13). A signed-in,
 * onboarded student with NO course lands here: no game until they join a class.
 * Serves two entry paths — manual code, and the invite link /join/{codigo}
 * (the `code` param is prefilled and auto-joins once). On success, claims gain
 * colegio+curso and the resolver routes to the game.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { readCetiClaims } from '@shared/lib/firebase/claims';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { adminService } from '@features/dashboard/data/adminService';
import { performLogoutAndGo } from '@features/auth/performLogout';

/** Refresh the ID token so the newly-set student claims apply, then route home. */
async function applyClaimsAndGo(router: ReturnType<typeof useRouter>): Promise<void> {
  const user = getFirebaseClients()?.auth.currentUser;
  if (user) {
    await user.getIdToken(true);
    useAuthStore.getState().setClaims(await readCetiClaims(user, true));
  }
  router.replace('/');
}

export default function JoinClassScreen({ code: codeParam }: { code?: string }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();

  const [code, setCode] = useState((codeParam ?? '').toUpperCase());
  const [busy, setBusy] = useState(false);
  const autoTried = useRef(false);

  const join = async (raw: string) => {
    const value = raw.trim().toUpperCase();
    if (!value) return;
    setBusy(true);
    try {
      await adminService.joinByCode(value);
      await applyClaimsAndGo(router);
    } catch (e) {
      showMessage(t('join.errorTitle'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Invite-link path: auto-join once when a code arrives via the URL.
  useEffect(() => {
    if (codeParam && !autoTried.current) {
      autoTried.current = true;
      void join(codeParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam]);

  return (
    <ScreenWrapper style={{ flex: 1, backgroundColor: colors.background.base }}>
      <View style={styles.wrap}>
        <View style={[styles.iconCircle, { backgroundColor: colors.brand.primary + '22' }]}>
          <Ionicons name="school-outline" size={30} color={colors.brand.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('join.gateTitle')}</Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          {t('join.gateSubtitle')}
        </Text>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.background.secondary,
              color: colors.text.primary,
              borderColor: colors.materials.border,
            },
          ]}
          placeholder={t('join.placeholder')}
          placeholderTextColor={colors.text.quaternary}
          autoCapitalize="characters"
          autoCorrect={false}
          value={code}
          onChangeText={setCode}
          editable={!busy}
          onSubmitEditing={() => void join(code)}
        />
        <TouchableOpacity
          style={[
            styles.btn,
            { backgroundColor: colors.brand.primary, opacity: busy || !code.trim() ? 0.6 : 1 },
          ]}
          onPress={() => void join(code)}
          disabled={busy || !code.trim()}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>{t('join.cta')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => void performLogoutAndGo(router)}
          accessibilityRole="button"
          style={styles.logout}
        >
          <Text style={[styles.logoutText, { color: colors.text.tertiary }]}>
            {t('join.wrongAccount')}
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
  subtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 420 },
  input: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 8,
  },
  btn: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  logout: { marginTop: 8, paddingVertical: 8 },
  logoutText: { fontSize: 13, fontWeight: '600' },
});
