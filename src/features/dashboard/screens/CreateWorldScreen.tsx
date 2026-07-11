/**
 * CreateWorldScreen — one-screen custom-world wizard (D-ORQ, RQ-PR12/CN06).
 *
 * The professor gives a name + description; "Generar preguntas" asks the Function
 * for a DRAFT (never persisted server-side), and "Guardar como borrador" writes
 * the world in ONE batch as an inactive entry (invisible to students). The manual
 * path ("crear vacío") creates just the entry — content is authored later in
 * the editor. Activation is gated by content minimums in ClassWorldsManager.
 *
 * UI copy rule: never surface "IA" to the user — the generation is presented as
 * "Generar preguntas" (the model is an implementation detail).
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { adminService } from '@features/dashboard/data/adminService';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { courseContentRepository } from '@features/dashboard/data/courseContentRepository';
import {
  buildPiecesFromDraft,
  type MundoBorrador,
} from '@features/dashboard/data/courseContentSchemas';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { ALL_COMPETENCIAS, COMPETENCIA_PERSONALIZADA } from '@features/learning/data/competencias';
import { CUSTOM_WORLD_COLOR } from '@features/learning/data/worldMeta';

export default function CreateWorldScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ cursoId: string }>();
  const cursoId = params.cursoId ?? '';
  const colegioId = useAuthStore((s) => s.colegioId) ?? '';
  const firebaseUid = useAuthStore((s) => s.firebaseUid) ?? '';

  const [nombre, setNombre] = useState('');
  const [tema, setTema] = useState('');
  const [competencia, setCompetencia] = useState<string | null>(null);
  const [draft, setDraft] = useState<MundoBorrador | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const accent = CUSTOM_WORLD_COLOR;

  const onGenerate = async () => {
    if (!nombre.trim()) {
      showMessage(t('createWorld.nombreRequired'));
      return;
    }
    setGenerating(true);
    try {
      const grado = (await rosterRepository.getCursoGrado(colegioId, cursoId)) ?? '9';
      const result = await adminService.generarBorradorMundo({
        colegioId,
        cursoId,
        nombre: nombre.trim(),
        tema: tema.trim() || nombre.trim(),
        grado,
      });
      setDraft(result);
    } catch (e) {
      if (__DEV__) console.warn('[createWorld] generate error:', e);
      showMessage(t('createWorld.generateError'), undefined, 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Avisa que el borrador se crea a partir de la descripción del mundo (el tema).
  const onGeneratePress = () => {
    if (!nombre.trim()) {
      showMessage(t('createWorld.nombreRequired'));
      return;
    }
    confirmAction({
      title: t('createWorld.generateConfirmTitle'),
      body: t('createWorld.generateConfirmBody'),
      confirmLabel: t('createWorld.generateConfirmCta'),
      cancelLabel: t('admin.cancel'),
      onConfirm: () => void onGenerate(),
    });
  };

  const onSave = async (withDraft: boolean) => {
    if (!nombre.trim()) {
      showMessage(t('createWorld.nombreRequired'));
      return;
    }
    setSaving(true);
    try {
      const [config, grado] = await Promise.all([
        classConfigRepository.get(colegioId, cursoId),
        rosterRepository.getCursoGrado(colegioId, cursoId).then((g) => g ?? '9'),
      ]);
      const worldId = `cw_${Date.now().toString(36)}`;
      const competenciaId = competencia ?? COMPETENCIA_PERSONALIZADA;
      const pieces =
        withDraft && draft ? buildPiecesFromDraft(draft, grado, worldId, competenciaId) : undefined;
      const created = await courseContentRepository.createCustomWorld({
        colegioId,
        cursoId,
        uid: firebaseUid,
        config,
        worldId,
        meta: {
          nombre: nombre.trim(),
          subtitle: draft?.subtitle,
          descripcion: draft?.descripcion || tema.trim() || undefined,
          competencia: competencia ?? undefined,
        },
        pieces,
      });
      if (created) {
        showMessage(t('createWorld.saved'), undefined, 'success');
        router.back();
      }
    } catch (e) {
      showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = [
    styles.input,
    {
      color: colors.text.primary,
      backgroundColor: colors.background.secondary,
      borderColor: colors.materials.border,
    },
  ];

  return (
    <ScreenWrapper style={{ flex: 1, backgroundColor: colors.background.base }}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('quiz.back')}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('createWorld.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>
          {t('createWorld.subtitle')}
        </Text>

        <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
          {t('createWorld.nombre')}
        </Text>
        <TextInput
          style={inputStyle}
          value={nombre}
          onChangeText={setNombre}
          placeholder={t('createWorld.nombrePlaceholder')}
          placeholderTextColor={colors.text.quaternary}
          maxLength={60}
        />

        <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
          {t('createWorld.tema')}
        </Text>
        <TextInput
          style={[...inputStyle, styles.multiline]}
          value={tema}
          onChangeText={setTema}
          placeholder={t('createWorld.temaPlaceholder')}
          placeholderTextColor={colors.text.quaternary}
          multiline
          maxLength={200}
        />

        <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
          {t('createWorld.competencia')}
        </Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            onPress={() => setCompetencia(null)}
            accessibilityRole="button"
            style={[
              styles.chip,
              {
                backgroundColor: competencia === null ? accent : colors.background.secondary,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: competencia === null ? '#fff' : colors.text.secondary },
              ]}
            >
              {t('createWorld.competenciaNinguna')}
            </Text>
          </TouchableOpacity>
          {ALL_COMPETENCIAS.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => setCompetencia(c.id)}
              accessibilityRole="button"
              style={[
                styles.chip,
                {
                  backgroundColor: competencia === c.id ? accent : colors.background.secondary,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: competencia === c.id ? '#fff' : colors.text.secondary },
                ]}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.helpText, { color: colors.text.quaternary }]}>
          {t('createWorld.competenciaHint')}
        </Text>

        {/* Generar preguntas (borrador a partir de la descripción del mundo) */}
        <TouchableOpacity
          onPress={onGeneratePress}
          disabled={generating || saving}
          accessibilityRole="button"
          style={[styles.iaBtn, { borderColor: accent, opacity: generating ? 0.6 : 1 }]}
        >
          {generating ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <Ionicons name="sparkles-outline" size={16} color={accent} />
          )}
          <Text style={[styles.iaBtnText, { color: accent }]}>
            {generating ? t('createWorld.generating') : t('createWorld.generate')}
          </Text>
        </TouchableOpacity>

        {draft && (
          <View style={[styles.draftCard, { borderColor: accent }]}>
            <Ionicons name="checkmark-circle" size={16} color={accent} />
            <Text style={[styles.draftText, { color: colors.text.primary }]}>
              {t('createWorld.generated', {
                teoria: draft.teoria.length,
                mc: draft.mc.length,
                vf: draft.vf.length,
                ordenar: draft.ordenar.length,
                ec: draft.eligeCamino.length,
              })}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => void onSave(true)}
          disabled={saving || (!draft && generating)}
          accessibilityRole="button"
          style={[styles.saveBtn, { backgroundColor: accent, opacity: saving ? 0.6 : 1 }]}
        >
          <Text style={styles.saveBtnText}>
            {draft ? t('createWorld.saveDraft') : t('createWorld.createEmpty')}
          </Text>
        </TouchableOpacity>
        {draft && (
          <TouchableOpacity
            onPress={() => void onSave(false)}
            disabled={saving}
            accessibilityRole="button"
            style={styles.secondaryBtn}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.text.tertiary }]}>
              {t('createWorld.createEmptyDiscard')}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 64, gap: 10 },
  backBtn: { alignSelf: 'flex-start', padding: 4 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, lineHeight: 18 },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  chipText: { fontSize: 12, fontWeight: '700' },
  helpText: { fontSize: 11, lineHeight: 15 },
  iaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 8,
  },
  iaBtnText: { fontSize: 14, fontWeight: '800' },
  draftCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  draftText: { flex: 1, fontSize: 12, lineHeight: 17 },
  saveBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryBtn: { alignItems: 'center', paddingVertical: 8 },
  secondaryBtnText: { fontSize: 13, fontWeight: '600' },
});
