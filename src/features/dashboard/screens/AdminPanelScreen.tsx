/**
 * AdminPanelScreen — Ceti admin provisioning panel (D-ADMIN / RQ-AD07/AD08).
 * The admin registers colegios and pre-authorizes professor emails into them.
 * All mutations go through Cloud Functions (the only trusted writers); the list
 * of authorizations is read directly (rules allow admin read).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { adminService } from '@features/dashboard/data/adminService';
import { performLogoutAndGo } from '@features/auth/performLogout';

type Colegio = { id: string; nombre: string };
type ProfeAutorizado = { email: string; colegioId: string };

/** Slug + short random suffix → a stable, collision-resistant colegio id. */
function slugColegioId(nombre: string): string {
  const slug = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 24);
  return `col_${slug || 'x'}_${Date.now().toString(36).slice(-4)}`;
}

export default function AdminPanelScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [autorizados, setAutorizados] = useState<ProfeAutorizado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [nuevoColegio, setNuevoColegio] = useState('');
  const [email, setEmail] = useState('');
  const [colegioSel, setColegioSel] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { colegios: cols } = await adminService.listColegios();
      setColegios(cols.map((c) => ({ id: c.id, nombre: c.nombre })));
      const db = getFirebaseClients()?.firestore;
      if (db) {
        const snap = await getDocs(collection(db, 'profesoresAutorizados'));
        setAutorizados(
          snap.docs.map((d) => {
            const data = d.data() as { email?: string; colegioId?: string };
            return { email: data.email ?? d.id, colegioId: data.colegioId ?? '' };
          })
        );
      }
    } catch (e) {
      showMessage(t('adminPanel.title'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (e) {
      showMessage(t('adminPanel.title'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onCreateColegio = () =>
    guard(async () => {
      const nombre = nuevoColegio.trim();
      if (!nombre) {
        showMessage(t('adminPanel.newColegioName'));
        return;
      }
      await adminService.registerColegio({ colegioId: slugColegioId(nombre), nombre });
      setNuevoColegio('');
      showMessage(t('adminPanel.colegioCreated'), undefined, 'success');
    });

  const onAuthorize = () =>
    guard(async () => {
      const mail = email.trim().toLowerCase();
      if (!mail) {
        showMessage(t('adminPanel.emailRequired'));
        return;
      }
      if (!colegioSel) {
        showMessage(t('adminPanel.colegioRequired'));
        return;
      }
      await adminService.authorizeProfesor({ email: mail, colegioId: colegioSel });
      setEmail('');
      showMessage(t('adminPanel.authorized'), undefined, 'success');
    });

  const onRevoke = (mail: string) =>
    confirmAction({
      title: t('adminPanel.revokeConfirmTitle', { email: mail }),
      body: t('adminPanel.revokeConfirmBody'),
      confirmLabel: t('adminPanel.revokeConfirm'),
      cancelLabel: t('admin.cancel'),
      destructive: true,
      onConfirm: () =>
        void guard(async () => {
          await adminService.revokeProfesorAuthorization(mail);
          showMessage(t('adminPanel.revoked'), undefined, 'success');
        }),
    });

  const colegioNombre = (id: string) => colegios.find((c) => c.id === id)?.nombre ?? id;

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.background.secondary,
      color: colors.text.primary,
      borderColor: colors.materials.border,
    },
  ];

  return (
    <ScreenWrapper style={{ flex: 1, backgroundColor: colors.background.base }}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text.primary }]}>
              {t('adminPanel.title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>
              {t('adminPanel.subtitle')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => void performLogoutAndGo(router)}
            accessibilityRole="button"
            accessibilityLabel={t('adminPanel.logout')}
            style={styles.logoutBtn}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={colors.brand.primary} />
        ) : (
          <>
            {/* Colegios */}
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              {t('adminPanel.colegiosTitle')}
            </Text>
            {colegios.length === 0 ? (
              <Text style={[styles.muted, { color: colors.text.tertiary }]}>
                {t('adminPanel.noColegios')}
              </Text>
            ) : (
              colegios.map((c) => (
                <View key={c.id} style={[styles.row, { borderColor: colors.background.secondary }]}>
                  <Ionicons name="business-outline" size={16} color={colors.brand.primary} />
                  <Text style={[styles.rowText, { color: colors.text.primary }]}>{c.nombre}</Text>
                </View>
              ))
            )}
            <View style={styles.inlineForm}>
              <TextInput
                style={[...inputStyle, { flex: 1 }]}
                value={nuevoColegio}
                onChangeText={setNuevoColegio}
                placeholder={t('adminPanel.newColegioName')}
                placeholderTextColor={colors.text.quaternary}
              />
              <TouchableOpacity
                style={[
                  styles.smallBtn,
                  { backgroundColor: colors.brand.primary, opacity: busy ? 0.6 : 1 },
                ]}
                onPress={() => void onCreateColegio()}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={styles.smallBtnText}>{t('adminPanel.createColegio')}</Text>
              </TouchableOpacity>
            </View>

            {/* Authorize professor */}
            <Text style={[styles.sectionTitle, { color: colors.text.primary, marginTop: 20 }]}>
              {t('adminPanel.authorizeTitle')}
            </Text>
            <Text style={[styles.muted, { color: colors.text.tertiary }]}>
              {t('adminPanel.authorizeHint')}
            </Text>
            <TextInput
              style={inputStyle}
              value={email}
              onChangeText={setEmail}
              placeholder={t('adminPanel.emailPlaceholder')}
              placeholderTextColor={colors.text.quaternary}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
              {t('adminPanel.pickColegio')}
            </Text>
            <View style={styles.chipRow}>
              {colegios.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setColegioSel(c.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: colegioSel === c.id }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        colegioSel === c.id ? colors.brand.primary : colors.background.secondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colegioSel === c.id ? '#fff' : colors.text.secondary },
                    ]}
                  >
                    {c.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[
                styles.btn,
                { backgroundColor: colors.brand.primary, opacity: busy ? 0.6 : 1 },
              ]}
              onPress={() => void onAuthorize()}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.btnText}>{t('adminPanel.authorize')}</Text>
            </TouchableOpacity>

            {/* Authorized list */}
            <Text style={[styles.sectionTitle, { color: colors.text.primary, marginTop: 20 }]}>
              {t('adminPanel.authorizedListTitle')}
            </Text>
            {autorizados.length === 0 ? (
              <Text style={[styles.muted, { color: colors.text.tertiary }]}>
                {t('adminPanel.noAuthorized')}
              </Text>
            ) : (
              autorizados.map((a) => (
                <View
                  key={a.email}
                  style={[styles.row, { borderColor: colors.background.secondary }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.rowText, { color: colors.text.primary }]}
                      numberOfLines={1}
                    >
                      {a.email}
                    </Text>
                    <Text
                      style={[styles.rowSub, { color: colors.text.tertiary }]}
                      numberOfLines={1}
                    >
                      {colegioNombre(a.colegioId)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => onRevoke(a.email)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={t('adminPanel.revoke')}
                    style={[styles.revokeBtn, { borderColor: colors.system.red }]}
                  >
                    <Text style={{ color: colors.system.red, fontWeight: '700', fontSize: 12 }}>
                      {t('adminPanel.revoke')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 64, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 13, lineHeight: 18 },
  logoutBtn: { padding: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 12 },
  muted: { fontSize: 13, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  rowText: { fontSize: 14, fontWeight: '600', flex: 1 },
  rowSub: { fontSize: 12 },
  inlineForm: { flexDirection: 'row', gap: 8, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  chipText: { fontSize: 12, fontWeight: '700' },
  btn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  smallBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  revokeBtn: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
});
