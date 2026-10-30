/**
 * AdminPanelScreen — Ceti admin provisioning panel (D-ADMIN / RQ-AD07).
 * The admin registers colegios; professors self-register into isolated colegios.
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
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { adminService } from '@features/dashboard/data/adminService';
import { performLogoutAndGo } from '@features/auth/performLogout';
import ModeracionBiblioteca from '@features/educadores/biblioteca/components/ModeracionBiblioteca';

type Colegio = { id: string; nombre: string };
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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [nuevoColegio, setNuevoColegio] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { colegios: cols } = await adminService.listColegios();
      setColegios(cols.map((c) => ({ id: c.id, nombre: c.nombre })));
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

            {/* Fase 9: mundos de la biblioteca pública ocultos por reportes. */}
            <ModeracionBiblioteca />
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
  inlineForm: { flexDirection: 'row', gap: 8, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  smallBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
