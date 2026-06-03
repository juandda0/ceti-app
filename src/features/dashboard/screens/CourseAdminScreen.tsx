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
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { rosterRepository, type EstudianteWithId } from '@features/dashboard/data/rosterRepository';
import { adminService } from '@features/dashboard/data/adminService';

const POLICY_VERSION = 'v1';

/** Per-course admin: roster (add students, Ley 1581 authorization) + assign teacher. */
export default function CourseAdminScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const colegioId = useAuthStore((s) => s.colegioId);
  const params = useLocalSearchParams<{ cursoId: string; nombre?: string }>();
  const cursoId = params.cursoId;
  const cursoNombre = params.nombre ?? cursoId;

  const [roster, setRoster] = useState<EstudianteWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [teacherEmail, setTeacherEmail] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!colegioId || !cursoId) return;
    setLoading(true);
    setRoster(await rosterRepository.getRoster(colegioId, cursoId));
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

  const onAddStudent = () =>
    guard(async () => {
      if (!colegioId || !cursoId || !label.trim()) return;
      const studentId = `stu_${Date.now().toString(36)}`;
      await adminService.addEstudiante(colegioId, cursoId, {
        studentId,
        displayLabel: label.trim(),
      });
      setLabel('');
    });

  const onToggleAuth = (sid: string, activo: boolean) =>
    guard(async () => {
      if (!colegioId || !cursoId) return;
      await adminService.setAuthorization({
        colegioId,
        cursoId,
        studentId: sid,
        estado: activo ? 'revocada' : 'otorgada',
        politicaVersion: POLICY_VERSION,
        canalEvidencia: 'consola-admin',
      });
    });

  const onAssignTeacher = () =>
    guard(async () => {
      if (!colegioId || !cursoId || !teacherEmail.trim()) return;
      await adminService.assignMember({
        email: teacherEmail.trim(),
        role: 'profesor',
        colegioId,
        cursoId,
      });
      setTeacherEmail('');
      Alert.alert(t('admin.assignOkTitle'), t('admin.teacherOk', { email: teacherEmail.trim() }));
    });

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

  const input = { backgroundColor: colors.background.secondary, color: colors.text.primary };

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
            <Text style={[styles.codeValue, { color: colors.brand.primary }]}>{code}</Text>
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
          >
            <Ionicons name="key-outline" size={16} color={colors.brand.primary} />
            <Text style={[styles.codeBtnText, { color: colors.brand.primary }]}>
              {code ? t('admin.classCodeShow') : t('admin.classCodeGen')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Add student */}
        <View style={styles.addRow}>
          <TextInput
            style={[styles.field, input, { flex: 1 }]}
            placeholder={t('admin.studentLabel')}
            placeholderTextColor={colors.text.tertiary}
            value={label}
            onChangeText={setLabel}
          />
          <TouchableOpacity
            style={[
              styles.addBtn,
              { backgroundColor: colors.brand.primary, opacity: busy || !label.trim() ? 0.6 : 1 },
            ]}
            onPress={onAddStudent}
            disabled={busy || !label.trim()}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

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
            return (
              <View
                key={s.studentId}
                style={[styles.row, { borderColor: colors.background.secondary }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, { color: colors.text.primary }]}>
                    {s.displayLabel}
                  </Text>
                  <Text
                    style={[
                      styles.rowSub,
                      { color: activo ? colors.system.green : colors.system.orange },
                    ]}
                  >
                    {t(`estados.${s.estado}`)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.authBtn,
                    { borderColor: activo ? colors.system.red : colors.system.green },
                  ]}
                  onPress={() => onToggleAuth(s.studentId, activo)}
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
              </View>
            );
          })
        )}

        {/* Assign teacher */}
        <Text style={[styles.section, { color: colors.text.secondary }]}>
          {t('admin.assignTeacher')}
        </Text>
        <Text style={[styles.hint, { color: colors.text.tertiary }]}>{t('admin.assignHint')}</Text>
        <View style={styles.addRow}>
          <TextInput
            style={[styles.field, input, { flex: 1 }]}
            placeholder={t('admin.email')}
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
            keyboardType="email-address"
            value={teacherEmail}
            onChangeText={setTeacherEmail}
          />
          <TouchableOpacity
            style={[
              styles.addBtn,
              {
                backgroundColor: colors.brand.primary,
                opacity: busy || !teacherEmail.trim() ? 0.6 : 1,
              },
            ]}
            onPress={onAssignTeacher}
            disabled={busy || !teacherEmail.trim()}
          >
            <Ionicons name="person-add-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 48, gap: 10 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14 },
  section: { fontSize: 13, fontWeight: '700', marginTop: 16 },
  hint: { fontSize: 12, lineHeight: 16 },
  muted: { fontSize: 13, marginTop: 4 },
  codeCard: { borderRadius: 14, padding: 16, gap: 6, alignItems: 'center', marginTop: 4 },
  codeLabel: { fontSize: 13, fontWeight: '600' },
  codeValue: { fontSize: 32, fontWeight: '900', letterSpacing: 4 },
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
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  field: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  addBtn: {
    width: 48,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
});
