import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { adminService } from '@features/dashboard/data/adminService';

type Colegio = { id: string; nombre: string; plan: string | null };

/** Platform super-admin console: register and list colegios (above rector level). */
export default function SuperAdminScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const [id, setId] = useState('');
  const [nombre, setNombre] = useState('');
  const [rectorEmail, setRectorEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await adminService.listColegios();
      setColegios(res.colegios);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const slug = id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');

  const onRegister = useCallback(async () => {
    if (!slug || !nombre.trim()) return;
    setBusy(true);
    try {
      const res = await adminService.registerColegio({
        colegioId: slug,
        nombre: nombre.trim(),
        rectorEmail: rectorEmail.trim() || undefined,
      });
      Alert.alert(
        t('superadmin.okTitle'),
        res.rectorAssigned ? t('superadmin.okWithRector') : t('superadmin.okNoRector')
      );
      setId('');
      setNombre('');
      setRectorEmail('');
      await reload();
    } catch (e) {
      Alert.alert(t('admin.error'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [slug, nombre, rectorEmail, reload, t]);

  const field = { backgroundColor: colors.background.secondary, color: colors.text.primary };

  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('superadmin.title')}</Text>

        <Text style={[styles.section, { color: colors.text.secondary }]}>
          {t('superadmin.newColegio')}
        </Text>
        <TextInput
          style={[styles.input, field]}
          placeholder={t('superadmin.colegioId')}
          placeholderTextColor={colors.text.tertiary}
          autoCapitalize="none"
          value={id}
          onChangeText={setId}
        />
        {slug ? (
          <Text style={[styles.slug, { color: colors.text.tertiary }]}>ID: {slug}</Text>
        ) : null}
        <TextInput
          style={[styles.input, field]}
          placeholder={t('superadmin.colegioNombre')}
          placeholderTextColor={colors.text.tertiary}
          value={nombre}
          onChangeText={setNombre}
        />
        <TextInput
          style={[styles.input, field]}
          placeholder={t('superadmin.rectorEmail')}
          placeholderTextColor={colors.text.tertiary}
          autoCapitalize="none"
          keyboardType="email-address"
          value={rectorEmail}
          onChangeText={setRectorEmail}
        />
        <Text style={[styles.hint, { color: colors.text.tertiary }]}>
          {t('superadmin.rectorHint')}
        </Text>
        <TouchableOpacity
          style={[
            styles.primary,
            {
              backgroundColor: colors.brand.primary,
              opacity: busy || !slug || !nombre.trim() ? 0.6 : 1,
            },
          ]}
          onPress={() => void onRegister()}
          disabled={busy || !slug || !nombre.trim()}
        >
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.primaryText}>{t('superadmin.register')}</Text>
        </TouchableOpacity>

        <Text style={[styles.section, { color: colors.text.secondary }]}>
          {t('superadmin.colegios')}
        </Text>
        {status === 'loading' && <ActivityIndicator color={colors.brand.primary} />}
        {status === 'error' && (
          <Text style={[styles.muted, { color: colors.text.secondary }]}>{t('admin.error')}</Text>
        )}
        {status === 'ready' && colegios.length === 0 && (
          <Text style={[styles.muted, { color: colors.text.tertiary }]}>
            {t('superadmin.none')}
          </Text>
        )}
        {colegios.map((c) => (
          <View key={c.id} style={[styles.row, { borderColor: colors.background.secondary }]}>
            <Ionicons name="business-outline" size={20} color={colors.brand.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowName, { color: colors.text.primary }]}>{c.nombre}</Text>
              <Text style={[styles.rowSub, { color: colors.text.tertiary }]}>
                {c.id}
                {c.plan ? ` · ${c.plan}` : ''}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 48, gap: 10 },
  title: { fontSize: 24, fontWeight: '800' },
  section: { fontSize: 13, fontWeight: '700', marginTop: 14 },
  hint: { fontSize: 12, lineHeight: 16 },
  muted: { fontSize: 13 },
  slug: { fontSize: 12, marginTop: -4 },
  input: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 2,
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12 },
});
