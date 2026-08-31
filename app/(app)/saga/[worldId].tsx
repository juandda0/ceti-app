/**
 * WorldSagaScreen — thin consumer of useWorldFlow (three-phase saga orchestrator).
 *
 *   Phase 1 (EligeCamino, 30% probability):
 *     Shows ONE situational scenario before the quiz. The trigger is
 *     DETERMINISTIC — uses hashStr(`${uid}:eligecamino:${worldId}`) % 100 < 30
 *     so the same student always gets the same trigger for the same world (R7).
 *     The situation selected is also deterministic (hashStr for index pick).
 *     No correct/wrong answer; just reflection on the consequence (R5, R10).
 *     The choice is NOT persisted per-student (R5).
 *
 *   Phase 2 (Micro-teoría):
 *     Shows the world's theory cards ONLY on the first entry for this student
 *     (tracked in useLearningFlowStore by uid+worldId key, persisted to MMKV).
 *     Subsequent entries skip this phase and go straight to the quiz.
 *     Decision rationale: showing it every time would block quiz retries; first-
 *     time-only ensures the student reads it before tackling questions.
 *
 *   Phase 3 (Quiz):
 *     The existing WorldQuizScreen, unchanged.
 *
 * The grado is resolved once via useStudentGrado; while null a spinner shows.
 * Both content fetches fire in parallel. Graceful degradation: if either repo
 * returns null or throws, the flow skips that phase and proceeds to quiz.
 *
 * RQ-ES02, RQ-FN09, RQ-ES06.
 */
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useStudentGrado } from '@features/learning/hooks/useStudentGrado';
import { useClassConfig } from '@features/learning/hooks/useClassConfig';
import { isWorldVisible } from '@features/learning/data/classConfig';
import { displayWorldDef } from '@features/learning/data/worldMeta';
import { useWorldFlow } from '@features/learning/hooks/useWorldFlow';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import MicroteoriaView from '@features/learning/components/MicroteoriaView';
import EligeCaminoView from '@features/learning/components/EligeCaminoView';
import WorldQuizScreen from '@features/learning/screens/WorldQuizScreen';
import { hasClassAccess } from '@features/learning/data/classAccess';

// ─── World metadata (mirrors WorldQuizScreen) ─────────────────────────────────

const WORLD_META: Record<string, { name: string; color: string }> = {
  world_1: { name: 'Planeta Origen', color: '#FF8A1F' },
  world_2: { name: 'Luna del Presupuesto', color: '#F7C95F' },
  world_3: { name: 'Estrella del Ahorro', color: '#58C88C' },
  world_4: { name: 'Nebulosa del Crédito', color: '#A884FF' },
  world_5: { name: 'Agujero Negro de las Deudas', color: '#5B9EF5' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorldSagaScreen() {
  const { worldId } = useLocalSearchParams<{ worldId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useThemeColors();

  const firebaseUid = useAuthStore((s) => s.firebaseUid);
  const localProfileId = useUserStore((s) => s.id);
  const uid = firebaseUid ?? localProfileId ?? 'demo';
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const hasAccess = hasClassAccess(colegioId, cursoId);

  const grado = useStudentGrado();

  // Soft-exit guard (D-ORQ, RQ-PR10 CA4). The class config is live: if the
  // professor removes/defocuses THIS world while the student is inside, the
  // student may finish the activity already on screen (never kicked mid-
  // question) but cannot re-enter; a fresh entry into a hidden world bounces.
  const { config: classConfig, loaded: classConfigLoaded } = useClassConfig();
  const visible = !classConfigLoaded || isWorldVisible(classConfig, worldId ?? '');
  const wasVisibleRef = useRef(false);
  useEffect(() => {
    // Reset the latch if the runtime ever reuses this instance for another world.
    wasVisibleRef.current = false;
  }, [worldId]);
  useEffect(() => {
    if (classConfigLoaded && isWorldVisible(classConfig, worldId ?? '')) {
      wasVisibleRef.current = true;
    }
  }, [classConfigLoaded, classConfig, worldId]);
  useEffect(() => {
    if (!hasAccess) router.replace('/saga' as never);
  }, [hasAccess, router]);
  useEffect(() => {
    // Entry guard: never was visible during this visit → not a soft exit, bounce.
    if (classConfigLoaded && !visible && !wasVisibleRef.current) {
      router.replace('/saga' as never);
    }
  }, [classConfigLoaded, visible, worldId, router]);
  const softExited = classConfigLoaded && !visible && wasVisibleRef.current;

  // Course content overrides (RQ-PR11) for THIS world, from the live config.
  const courseContent =
    colegioId && cursoId && worldId
      ? {
          colegioId,
          cursoId,
          overrides: classConfig?.overrides?.[worldId],
          version: classConfig?.version ?? 0,
        }
      : null;

  const { phase, situacion, microteoriaBank, handleECFinish, handleMTFinish } = useWorldFlow(
    uid,
    grado,
    worldId,
    courseContent
  );

  const configEntry = classConfig?.mundos?.find((m) => m.worldId === worldId);
  const disp = displayWorldDef(worldId ?? '', configEntry);
  const fallback = WORLD_META[worldId ?? ''] ?? { name: 'Mundo', color: '#FF8A1F' };
  const meta = { name: disp?.name ?? fallback.name, color: disp?.color ?? fallback.color };

  if (!hasAccess) return null;

  let content: React.ReactElement;
  if (phase === 'loading' || !grado) {
    // ── Loading ──────────────────────────────────────────────────────────────
    content = (
      <ScreenWrapper
        style={{
          flex: 1,
          backgroundColor: colors.background.base,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={meta.color} />
        <Text style={[styles.loadingText, { color: colors.text.tertiary }]}>
          {t('saga.loading')}
        </Text>
      </ScreenWrapper>
    );
  } else if (phase === 'eligecamino' && situacion !== null) {
    // ── EligeCamino phase ────────────────────────────────────────────────────
    content = (
      <EligeCaminoView
        situacion={situacion}
        worldName={meta.name}
        accentColor={meta.color}
        onFinish={handleECFinish}
      />
    );
  } else if (phase === 'microteoria' && microteoriaBank !== null) {
    // ── Micro-teoría phase ───────────────────────────────────────────────────
    content = (
      <MicroteoriaView
        cards={microteoriaBank.cards}
        worldName={meta.name}
        accentColor={meta.color}
        onFinish={handleMTFinish}
      />
    );
  } else {
    // ── Quiz phase (default / graceful fallback) ─────────────────────────────
    content = <WorldQuizScreen />;
  }

  return (
    <View style={{ flex: 1 }}>
      {softExited && (
        <View
          style={[
            styles.classUpdatedBanner,
            { backgroundColor: colors.background.elevated, borderColor: meta.color },
          ]}
          accessibilityRole="alert"
        >
          <Ionicons name="megaphone-outline" size={16} color={meta.color} />
          <Text style={[styles.classUpdatedText, { color: colors.text.primary }]}>
            {t('worlds.classUpdated')}
          </Text>
        </View>
      )}
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingText: {
    ...Typography.footnote,
    marginTop: 16,
  },
  classUpdatedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  classUpdatedText: {
    ...Typography.footnote,
    fontWeight: '600',
    flex: 1,
  },
});
