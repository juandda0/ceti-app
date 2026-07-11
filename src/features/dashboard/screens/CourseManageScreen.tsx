import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { rosterRepository, type EstudianteWithId } from '@features/dashboard/data/rosterRepository';
import { adminService } from '@features/dashboard/data/adminService';
import ClassWorldsManager from '@features/dashboard/components/ClassWorldsManager';

const POLICY_VERSION = 'v1';

/**
 * Per-course operations screen for the profesor (D-PIVOT): class code, class
 * collaboration toggle, roster with Ley 1581 attestation, and suppression. The
 * profesor operates ONLY their own course (firestore.rules + the Cloud Functions
 * enforce it). Assigning teachers / creating structure is Admin SDK only (backend).
 */
export default function CourseManageScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const colegioId = useAuthStore((s) => s.colegioId);
  const params = useLocalSearchParams<{ cursoId: string; nombre?: string }>();
  const cursoId = params.cursoId;
  const cursoNombre = params.nombre ?? cursoId;

  const [roster, setRoster] = useState<EstudianteWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!colegioId || !cursoId) return;
    setLoading(true);
    const r = await rosterRepository.getRoster(colegioId, cursoId);
    setRoster(r);
    setLoading(false);
  }, [colegioId, cursoId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (e) {
      Alert.alert(t('admin.error'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onToggleAuth = (uid: string, activo: boolean) =>
    guard(async () => {
      if (!colegioId || !cursoId) return;
      await adminService.atestar({
        colegioId,
        cursoId,
        uid,
        atestado: !activo,
        politicaVersion: POLICY_VERSION,
      });
    });

  const onSuppress = (uid: string) =>
    Alert.alert(t('admin.suppressConfirmTitle'), t('admin.suppressConfirmBody'), [
      { text: t('admin.cancel'), style: 'cancel' },
      {
        text: t('admin.suppressConfirm'),
        style: 'destructive',
        onPress: () =>
          guard(async () => {
            if (!colegioId || !cursoId) return;
            await adminService.suppressStudent({ colegioId, cursoId, uid });
            Alert.alert(t('admin.suppressOkTitle'), t('admin.suppressOk'));
          }),
      },
    ]);

  const onCopyCode = () => {
    if (!code || Platform.OS !== 'web') return;
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.clipboard) {
      void nav.clipboard.writeText(code);
      Alert.alert(t('admin.codeCopied'));
    }
  };

  const onGenerateCode = async () => {
    if (!colegioId || !cursoId) return;
    setCodeBusy(true);
    try {
      const res = await adminService.generateClassCode(colegioId, cursoId);
      setCode(res.code);
    } catch (e) {
      Alert.alert(t('admin.error'), e instanceof Error ? e.message : String(e));
    } finally {
      setCodeBusy(false);
    }
  };

  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{cursoNombre}</Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          {t('admin.rosterTitle')}
        </Text>

        {/* Class code */}
        <View style={[styles.codeCard, { backgroundColor: colors.background.secondary }]}>
          <Text style={[styles.codeLabel, { color: colors.text.secondary }]}>
            {t('admin.classCode')}
          </Text>
          {code ? (
            <>
              <Text style={[styles.codeValue, { color: colors.brand.primary }]}>{code}</Text>
              <View style={styles.qrWrap}>
                <QRCode value={code} size={132} backgroundColor="#FFFFFF" color="#000000" />
              </View>
              <Text style={[styles.codeHint, { color: colors.text.tertiary }]}>
                {t('admin.classCodeScan')}
              </Text>
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={[styles.codeBtn, { borderColor: colors.brand.primary }]}
                  onPress={onCopyCode}
                  accessibilityRole="button"
                  accessibilityLabel={t('admin.copyCode')}
                >
                  <Ionicons name="copy-outline" size={16} color={colors.brand.primary} />
                  <Text style={[styles.codeBtnText, { color: colors.brand.primary }]}>
                    {t('admin.copyCode')}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text style={[styles.codeHint, { color: colors.text.tertiary }]}>
              {t('admin.classCodeHint')}
            </Text>
          )}
          <TouchableOpacity
            style={[
              styles.codeBtn,
              { borderColor: colors.brand.primary, opacity: codeBusy ? 0.6 : 1 },
            ]}
            onPress={() => void onGenerateCode()}
            disabled={codeBusy}
            accessibilityRole="button"
          >
            <Ionicons name="key-outline" size={16} color={colors.brand.primary} />
            <Text style={[styles.codeBtnText, { color: colors.brand.primary }]}>
              {code ? t('admin.classCodeShow') : t('admin.classCodeGen')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Class worlds curation (D-ORQ, RQ-PR10): show/hide, reorder, focus. */}
        {colegioId && cursoId && <ClassWorldsManager colegioId={colegioId} cursoId={cursoId} />}

        {/* Students self-join by code (no manual roster slot). */}
        <Text style={[styles.hint, { color: colors.text.tertiary }]}>
          {t('admin.rosterSelfJoinHint')}
        </Text>

        {/* Roster */}
        {loading ? (
          <ActivityIndicator style={{ marginTop: 8 }} color={colors.brand.primary} />
        ) : roster.length === 0 ? (
          <Text style={[styles.muted, { color: colors.text.tertiary }]}>
            {t('admin.emptyRoster')}
          </Text>
        ) : (
          roster.map((s) => {
            const activo = s.estado === 'activo';
            const suprimido = s.estado === 'suprimido';
            return (
              <View key={s.uid} style={[styles.row, { borderColor: colors.background.secondary }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, { color: colors.text.primary }]}>{s.nombre}</Text>
                  <Text
                    style={[
                      styles.rowSub,
                      { color: activo ? colors.system.green : colors.system.orange },
                    ]}
                  >
                    {t(`estados.${s.estado}`)}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  {!suprimido && (
                    <TouchableOpacity
                      style={[
                        styles.authBtn,
                        { borderColor: activo ? colors.system.red : colors.system.green },
                      ]}
                      onPress={() => onToggleAuth(s.uid, activo)}
                      disabled={busy}
                    >
                      <Text
                        style={{
                          color: activo ? colors.system.red : colors.system.green,
                          fontWeight: '700',
                          fontSize: 12,
                        }}
                      >
                        {activo ? t('admin.revoke') : t('admin.authorize')}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {!suprimido && (
                    <TouchableOpacity
                      style={[styles.iconBtn, { borderColor: colors.system.red }]}
                      onPress={() => onSuppress(s.uid)}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={t('admin.suppress')}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.system.red} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 48, gap: 10 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14 },
  hint: { fontSize: 12, lineHeight: 16 },
  muted: { fontSize: 13, marginTop: 4 },
  codeCard: { borderRadius: 14, padding: 16, gap: 6, alignItems: 'center', marginTop: 4 },
  codeLabel: { fontSize: 13, fontWeight: '600' },
  codeValue: { fontSize: 32, fontWeight: '900', letterSpacing: 4 },
  qrWrap: { padding: 10, borderRadius: 12, backgroundColor: '#FFFFFF', marginVertical: 4 },
  codeHint: { fontSize: 12, textAlign: 'center' },
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  codeBtnText: { fontSize: 14, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, fontWeight: '600' },
  authBtn: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
