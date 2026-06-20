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
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { rosterRepository, type CursoWithId } from '@features/dashboard/data/rosterRepository';
import { adminService } from '@features/dashboard/data/adminService';
import type { Grado, Role } from '@shared/types/tenancy';

const ASSIGNABLE: Exclude<Role, 'estudiante' | 'admin' | 'rector'>[] = ['coordinador', 'profesor'];
const GRADOS: Grado[] = ['9', '10', '11'];

/**
 * Admin console home (platform admin only — §1.3 matrix): create courses,
 * list them, assign staff. Access is enforced by AdminLayout which redirects
 * any non-admin role back to the staff home before reaching this screen.
 */
export default function AdminHomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const colegioId = useAuthStore((s) => s.colegioId);

  const [cursos, setCursos] = useState<CursoWithId[]>([]);
  const [loading, setLoading] = useState(true);

  const [cursoId, setCursoId] = useState('');
  const [nombre, setNombre] = useState('');
  const [grado, setGrado] = useState<Grado>('9');
  const [creating, setCreating] = useState(false);

  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<Exclude<Role, 'estudiante'>>('profesor');
  const [assigning, setAssigning] = useState(false);

  const cursoSlug = cursoId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');

  const reload = useCallback(async () => {
    if (!colegioId) return;
    setLoading(true);
    setCursos(await rosterRepository.getAllCursos(colegioId));
    setLoading(false);
  }, [colegioId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onCreateCurso = useCallback(async () => {
    if (!colegioId || !cursoSlug || !nombre.trim()) return;
    setCreating(true);
    try {
      await adminService.createCurso({
        colegioId,
        cursoId: cursoSlug,
        nombre: nombre.trim(),
        grado,
      });
      setCursoId('');
      setNombre('');
      setGrado('9');
      await reload();
    } catch (e) {
      Alert.alert(t('admin.error'), e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }, [colegioId, cursoSlug, nombre, grado, reload, t]);

  const onAssign = useCallback(async () => {
    if (!colegioId || !memberEmail.trim()) return;
    setAssigning(true);
    try {
      await adminService.assignRole({
        email: memberEmail.trim(),
        role: memberRole,
        colegioId,
      });
      Alert.alert(t('admin.assignOkTitle'), t('admin.assignOk', { email: memberEmail.trim() }));
      setMemberEmail('');
    } catch (e) {
      Alert.alert(t('admin.error'), e instanceof Error ? e.message : String(e));
    } finally {
      setAssigning(false);
    }
  }, [colegioId, memberEmail, memberRole, t]);

  const input = {
    backgroundColor: colors.background.secondary,
    color: colors.text.primary,
    borderColor: colors.background.secondary,
  };

  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('admin.title')}</Text>

        {/* Create course */}
        <Text style={[styles.section, { color: colors.text.secondary }]}>
          {t('admin.newCourse')}
        </Text>
        <TextInput
          style={[styles.field, input]}
          placeholder={t('admin.courseId')}
          placeholderTextColor={colors.text.tertiary}
          autoCapitalize="none"
          value={cursoId}
          onChangeText={setCursoId}
        />
        {cursoSlug ? (
          <Text style={[styles.hint, { color: colors.text.tertiary }]}>ID: {cursoSlug}</Text>
        ) : null}
        <TextInput
          style={[styles.field, input]}
          placeholder={t('admin.courseName')}
          placeholderTextColor={colors.text.tertiary}
          value={nombre}
          onChangeText={setNombre}
        />
        <View style={styles.roleRow}>
          {GRADOS.map((g) => {
            const sel = g === grado;
            return (
              <TouchableOpacity
                key={g}
                onPress={() => setGrado(g)}
                style={[
                  styles.chip,
                  { backgroundColor: sel ? colors.brand.primary : colors.background.secondary },
                ]}
              >
                <Text style={{ color: sel ? '#fff' : colors.text.secondary, fontWeight: '600' }}>
                  {t('admin.gradoChip', { grado: g })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: colors.brand.primary, opacity: creating ? 0.6 : 1 },
          ]}
          onPress={() => void onCreateCurso()}
          disabled={creating || !cursoSlug || !nombre.trim()}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.primaryText}>{t('admin.createCourse')}</Text>
        </TouchableOpacity>

        {/* Course list */}
        <Text style={[styles.section, { color: colors.text.secondary }]}>{t('admin.courses')}</Text>
        {loading ? (
          <ActivityIndicator color={colors.brand.primary} />
        ) : cursos.length === 0 ? (
          <Text style={[styles.muted, { color: colors.text.tertiary }]}>
            {t('admin.noCourses')}
          </Text>
        ) : (
          cursos.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.row, { borderColor: colors.background.secondary }]}
              onPress={() =>
                router.push(
                  `/(staff)/admin/curso/${c.id}?nombre=${encodeURIComponent(c.nombre)}` as Href
                )
              }
            >
              <Ionicons name="people-outline" size={20} color={colors.brand.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, { color: colors.text.primary }]}>{c.nombre}</Text>
                <Text style={[styles.rowSub, { color: colors.text.tertiary }]}>{c.grado}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
          ))
        )}

        {/* Assign staff member */}
        <Text style={[styles.section, { color: colors.text.secondary }]}>
          {t('admin.assignMember')}
        </Text>
        <Text style={[styles.hint, { color: colors.text.tertiary }]}>{t('admin.assignHint')}</Text>
        <TextInput
          style={[styles.field, input]}
          placeholder={t('admin.email')}
          placeholderTextColor={colors.text.tertiary}
          autoCapitalize="none"
          keyboardType="email-address"
          value={memberEmail}
          onChangeText={setMemberEmail}
        />
        <View style={styles.roleRow}>
          {ASSIGNABLE.map((r) => {
            const sel = r === memberRole;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => setMemberRole(r)}
                style={[
                  styles.chip,
                  { backgroundColor: sel ? colors.brand.primary : colors.background.secondary },
                ]}
              >
                <Text style={{ color: sel ? '#fff' : colors.text.secondary, fontWeight: '600' }}>
                  {t(`roles.${r}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: colors.brand.primary, opacity: assigning ? 0.6 : 1 },
          ]}
          onPress={() => void onAssign()}
          disabled={assigning || !memberEmail.trim()}
        >
          <Ionicons name="person-add-outline" size={18} color="#fff" />
          <Text style={styles.primaryText}>{t('admin.assign')}</Text>
        </TouchableOpacity>
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
  field: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  primaryBtn: {
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
  roleRow: { flexDirection: 'row', gap: 8 },
  chip: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
});
