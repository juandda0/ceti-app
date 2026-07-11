import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { readCetiClaims } from '@shared/lib/firebase/claims';
import { adminService } from '@features/dashboard/data/adminService';

/** Refresh the ID token so newly-set claims (role/tenant) apply without re-login. */
async function refreshClaims(): Promise<void> {
  const clients = getFirebaseClients();
  const user = clients?.auth.currentUser;
  if (!user) return;
  await user.getIdToken(true);
  useAuthStore.getState().setClaims(await readCetiClaims(user, true));
}

/**
 * For signed-in accounts not yet linked to a colegio: enter the teacher's class
 * code to self-join a course (Google-Classroom style). Hidden once linked.
 */
export default function JoinClassBanner() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const colegioId = useAuthStore((s) => s.colegioId);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  if (colegioId) return null; // already linked

  const onJoin = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      await adminService.joinByCode(code.trim());
      await refreshClaims();
      showMessage(t('join.okTitle'), t('join.ok'), 'success');
      setCode('');
    } catch (e) {
      showMessage(t('join.errorTitle'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background.elevated }]}>
      <View style={styles.header}>
        <Ionicons name="school-outline" size={16} color={colors.brand.primary} />
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('join.title')}</Text>
      </View>
      <Text style={[styles.hint, { color: colors.text.tertiary }]}>{t('join.hint')}</Text>
      <View style={styles.row}>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.background.secondary, color: colors.text.primary },
          ]}
          placeholder={t('join.placeholder')}
          placeholderTextColor={colors.text.tertiary}
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
        />
        <TouchableOpacity
          style={[
            styles.btn,
            { backgroundColor: colors.brand.primary, opacity: busy || !code.trim() ? 0.6 : 1 },
          ]}
          onPress={() => void onJoin()}
          disabled={busy || !code.trim()}
        >
          <Text style={styles.btnText}>{t('join.cta')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 14, padding: 14, gap: 8, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 14, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 16 },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  btn: { borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
