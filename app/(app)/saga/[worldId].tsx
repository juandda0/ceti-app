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
import { ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useStudentGrado } from '@features/learning/hooks/useStudentGrado';
import { useWorldFlow } from '@features/learning/hooks/useWorldFlow';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import MicroteoriaView from '@features/learning/components/MicroteoriaView';
import EligeCaminoView from '@features/learning/components/EligeCaminoView';
import WorldQuizScreen from '@features/learning/screens/WorldQuizScreen';

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
  const { t } = useTranslation();
  const colors = useThemeColors();

  const firebaseUid = useAuthStore((s) => s.firebaseUid);
  const localProfileId = useUserStore((s) => s.id);
  const uid = firebaseUid ?? localProfileId ?? 'demo';

  const grado = useStudentGrado();

  const { phase, situacion, microteoriaBank, handleECFinish, handleMTFinish } = useWorldFlow(
    uid,
    grado,
    worldId
  );

  const meta = WORLD_META[worldId ?? ''] ?? { name: 'Mundo', color: '#FF8A1F' };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (phase === 'loading' || !grado) {
    return (
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
  }

  // ── EligeCamino phase ─────────────────────────────────────────────────────
  if (phase === 'eligecamino' && situacion !== null) {
    return (
      <EligeCaminoView
        situacion={situacion}
        worldName={meta.name}
        accentColor={meta.color}
        onFinish={handleECFinish}
      />
    );
  }

  // ── Micro-teoría phase ────────────────────────────────────────────────────
  if (phase === 'microteoria' && microteoriaBank !== null) {
    return (
      <MicroteoriaView
        cards={microteoriaBank.cards}
        worldName={meta.name}
        accentColor={meta.color}
        onFinish={handleMTFinish}
      />
    );
  }

  // ── Quiz phase (default / graceful fallback) ───────────────────────────────
  return <WorldQuizScreen />;
}

const styles = StyleSheet.create({
  loadingText: {
    ...Typography.footnote,
    marginTop: 16,
  },
});
