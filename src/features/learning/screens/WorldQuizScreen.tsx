/**
 * WorldQuizScreen — static quiz (R7, R9, R11).
 *
 * Traverses 10 assembled items linearly (indices 0..9). No adaptive selection
 * (R7). No certificate generation (R11). Supports three item types:
 *   - multiple_choice: tap one of opciones[]
 *   - true_false: tap Verdadero / Falso
 *   - ordenar: tap items in sequence to build an order; submit and compare to
 *     ordenCanonico (never shown before submission — R9)
 */
import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  useQuestionBankStore,
  QUESTIONS_PER_WORLD,
} from '@features/learning/store/useQuestionBankStore';
import { useStudentGrado } from '@features/learning/hooks/useStudentGrado';
import { useClassConfig } from '@features/learning/hooks/useClassConfig';
import { displayWorldDef } from '@features/learning/data/worldMeta';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { buildWorldProgress } from '@features/learning/data/worldProgress';
import { worldProgressRepository } from '@features/dashboard/data/worldProgressRepository';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { Typography } from '@shared/constants/typography';
import { Spacing, BorderRadius } from '@shared/constants/theme';
import type {
  QuizItem,
  MultipleChoiceItem,
  TrueFalseItem,
  OrdenarItem,
  WorldId,
} from '@features/learning/data/quiz.types';
import type { ThemeColors } from '@shared/constants/colors';

// ─── World metadata ───────────────────────────────────────────────────────────

const WORLD_META: Record<string, { name: string; color: string }> = {
  world_1: { name: 'Planeta Origen', color: '#FF8A1F' },
  world_2: { name: 'Luna del Presupuesto', color: '#F7C95F' },
  world_3: { name: 'Estrella del Ahorro', color: '#58C88C' },
  world_4: { name: 'Nebulosa del Crédito', color: '#A884FF' },
  world_5: { name: 'Agujero Negro de las Deudas', color: '#5B9EF5' },
};

// ─── Correctness helpers ───────────────────────────────────────────────────────

function isMCCorrect(item: MultipleChoiceItem, selectedIndex: number): boolean {
  return selectedIndex === item.correctIndex;
}

function isTFCorrect(item: TrueFalseItem, selected: boolean): boolean {
  return selected === item.respuesta;
}

/**
 * Checks an ordenar submission. `chosen` is the sequence of indices into
 * `item.elementos[]` in the order the student built. Correct iff it equals
 * `item.ordenCanonico` element-by-element.
 */
function isOrdenarCorrect(item: OrdenarItem, chosen: number[]): boolean {
  if (chosen.length !== item.ordenCanonico.length) return false;
  return chosen.every((v, i) => v === item.ordenCanonico[i]);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuizHeader({
  worldName,
  accentColor,
  currentIndex,
  total,
  onBack,
  colors,
  insetTop,
  backLabel,
}: {
  worldName: string;
  accentColor: string;
  currentIndex: number;
  total: number;
  onBack: () => void;
  colors: ThemeColors;
  insetTop: number;
  backLabel: string;
}) {
  const pct = total > 0 ? (currentIndex / total) * 100 : 0;
  return (
    <View
      style={[
        headerSt.wrap,
        {
          paddingTop: Math.max(insetTop, Platform.OS === 'ios' ? 12 : 8) + 8,
          backgroundColor: colors.background.elevated,
          borderBottomColor: colors.materials.border,
        },
      ]}
    >
      <View style={headerSt.row}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={12}
          style={headerSt.backBtn}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={headerSt.center}>
          <Text style={[headerSt.worldLabel, { color: accentColor }]}>{worldName}</Text>
          <Text style={[headerSt.counter, { color: colors.text.tertiary }]}>
            {currentIndex}/{total}
          </Text>
        </View>
        <View style={{ width: 34 }} />
      </View>
      <View style={[headerSt.track, { backgroundColor: colors.materials.highlight }]}>
        <View
          style={[headerSt.fill, { width: `${pct}%` as const, backgroundColor: accentColor }]}
        />
      </View>
    </View>
  );
}

function OptionButton({
  label,
  state,
  onPress,
  colors,
}: {
  label: string;
  state: 'idle' | 'selected' | 'correct' | 'wrong';
  onPress: () => void;
  colors: ThemeColors;
}) {
  const bg =
    state === 'correct'
      ? (colors.fill?.greenSubtle ?? '#1A3B2B')
      : state === 'wrong'
        ? (colors.fill?.redSubtle ?? '#3B1A1A')
        : state === 'selected'
          ? colors.materials.highlight
          : colors.background.elevated;
  const border =
    state === 'correct'
      ? colors.system.green
      : state === 'wrong'
        ? colors.system.red
        : state === 'selected'
          ? colors.materials.borderFocus
          : colors.materials.border;
  const textColor =
    state === 'correct'
      ? colors.system.green
      : state === 'wrong'
        ? colors.system.red
        : colors.text.primary;

  return (
    <TouchableOpacity
      activeOpacity={state === 'idle' || state === 'selected' ? 0.75 : 1}
      onPress={state === 'idle' || state === 'selected' ? onPress : undefined}
      style={[optSt.btn, { backgroundColor: bg, borderColor: border }]}
    >
      <Text style={[optSt.label, { color: textColor }]}>{label}</Text>
      {state === 'correct' && (
        <Ionicons name="checkmark-circle" size={20} color={colors.system.green} />
      )}
      {state === 'wrong' && <Ionicons name="close-circle" size={20} color={colors.system.red} />}
    </TouchableOpacity>
  );
}

function FeedbackBanner({
  isCorrect,
  explanation,
  colors,
  t,
}: {
  isCorrect: boolean;
  explanation: string;
  colors: ThemeColors;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const bgColor = isCorrect
    ? (colors.fill?.greenSubtle ?? '#1A3B2B')
    : (colors.fill?.redSubtle ?? '#3B1A1A');
  const iconName = isCorrect ? 'checkmark-circle' : 'close-circle';
  const iconColor = isCorrect ? colors.system.green : colors.system.red;
  const label = isCorrect ? t('quiz.correct') : t('quiz.incorrect');

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      style={[feedbackSt.wrap, { backgroundColor: bgColor, borderColor: iconColor }]}
    >
      <View style={feedbackSt.titleRow}>
        <Ionicons name={iconName} size={20} color={iconColor} />
        <Text style={[feedbackSt.title, { color: iconColor }]}>{label}</Text>
      </View>
      <Text style={[feedbackSt.text, { color: colors.text.secondary }]}>{explanation}</Text>
    </Animated.View>
  );
}

// ─── Ordenar UI ───────────────────────────────────────────────────────────────

/**
 * Tap-to-sequence ordenar widget.
 *
 * Two panels:
 *   - "available": elementos not yet chosen, shown in the initial shuffled order.
 *   - "chosen": sequence the student is building (top→bottom = position 1→N).
 *
 * Tapping an available element appends it to chosen.
 * Tapping a chosen element removes it (returns to available in original position).
 * After submission, shows each element with correct/wrong coloring per position.
 *
 * IMPORTANT: ordenCanonico is NEVER displayed (R9). Correctness is only revealed
 * after the student submits.
 */
function OrdenarWidget({
  item,
  submitted,
  chosen,
  onChosen,
  colors,
  t,
}: {
  item: OrdenarItem;
  submitted: boolean;
  chosen: number[];
  onChosen: (indices: number[]) => void;
  colors: ThemeColors;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const available = item.elementos
    .map((el, idx) => ({ el, idx }))
    .filter(({ idx }) => !chosen.includes(idx));

  const handlePickAvailable = (idx: number) => {
    if (submitted) return;
    onChosen([...chosen, idx]);
  };

  const handleRemoveChosen = (pos: number) => {
    if (submitted) return;
    onChosen(chosen.filter((_, i) => i !== pos));
  };

  return (
    <View style={ordenarSt.wrap}>
      {/* Chosen sequence */}
      <Text style={[ordenarSt.panelLabel, { color: colors.text.tertiary }]}>
        {t('quiz.ordenarSequence')}
      </Text>
      <View style={ordenarSt.panel}>
        {chosen.length === 0 ? (
          <Text style={[ordenarSt.emptyHint, { color: colors.text.quaternary }]}>
            {t('quiz.ordenarTapToAdd')}
          </Text>
        ) : (
          chosen.map((elIdx, pos) => {
            let state: 'idle' | 'correct' | 'wrong' = 'idle';
            if (submitted) {
              state = item.ordenCanonico[pos] === elIdx ? 'correct' : 'wrong';
            }
            const bg =
              state === 'correct'
                ? (colors.fill?.greenSubtle ?? '#1A3B2B')
                : state === 'wrong'
                  ? (colors.fill?.redSubtle ?? '#3B1A1A')
                  : colors.materials.highlight;
            const border =
              state === 'correct'
                ? colors.system.green
                : state === 'wrong'
                  ? colors.system.red
                  : colors.materials.borderFocus;
            const textColor =
              state === 'correct'
                ? colors.system.green
                : state === 'wrong'
                  ? colors.system.red
                  : colors.text.primary;
            return (
              <TouchableOpacity
                key={`chosen-${pos}`}
                onPress={() => handleRemoveChosen(pos)}
                activeOpacity={submitted ? 1 : 0.75}
                style={[ordenarSt.item, { backgroundColor: bg, borderColor: border }]}
              >
                <Text style={[ordenarSt.posNum, { color: textColor }]}>{pos + 1}.</Text>
                <Text style={[ordenarSt.itemText, { color: textColor }]}>
                  {item.elementos[elIdx]}
                </Text>
                {state === 'correct' && (
                  <Ionicons name="checkmark-circle" size={16} color={colors.system.green} />
                )}
                {state === 'wrong' && (
                  <Ionicons name="close-circle" size={16} color={colors.system.red} />
                )}
                {state === 'idle' && !submitted && (
                  <Ionicons name="remove-circle-outline" size={16} color={colors.text.tertiary} />
                )}
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Available elements */}
      {!submitted && available.length > 0 && (
        <>
          <Text style={[ordenarSt.panelLabel, { color: colors.text.tertiary }]}>
            {t('quiz.ordenarAvailable')}
          </Text>
          <View style={ordenarSt.panel}>
            {available.map(({ el, idx }) => (
              <TouchableOpacity
                key={`avail-${idx}`}
                onPress={() => handlePickAvailable(idx)}
                activeOpacity={0.75}
                style={[
                  ordenarSt.item,
                  {
                    backgroundColor: colors.background.elevated,
                    borderColor: colors.materials.border,
                  },
                ]}
              >
                <Text style={[ordenarSt.itemText, { color: colors.text.primary }]}>{el}</Text>
                <Ionicons name="add-circle-outline" size={16} color={colors.text.tertiary} />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// ─── CompletionScreen ─────────────────────────────────────────────────────────

function CompletionScreen({
  worldName,
  accentColor,
  correct,
  total,
  onBack,
  colors,
  insetTop,
  insetBottom,
  t,
}: {
  worldName: string;
  accentColor: string;
  correct: number;
  total: number;
  onBack: () => void;
  colors: ThemeColors;
  insetTop: number;
  insetBottom: number;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <ScreenWrapper style={{ flex: 1, backgroundColor: colors.background.base }}>
      <View
        style={[
          completeSt.wrap,
          {
            paddingTop: Math.max(insetTop, 20) + 32,
            paddingBottom: Math.max(insetBottom, 24) + 24,
          },
        ]}
      >
        <Animated.View entering={FadeIn.duration(300)} style={completeSt.center}>
          <View style={[completeSt.iconCircle, { backgroundColor: accentColor + '22' }]}>
            <Ionicons name="trophy" size={52} color={accentColor} />
          </View>
          <Text style={[completeSt.title, { color: colors.text.primary }]}>
            {t('quiz.worldComplete')}
          </Text>
          <Text style={[completeSt.subtitle, { color: colors.text.secondary }]}>{worldName}</Text>
          <View
            style={[
              completeSt.scoreCard,
              { backgroundColor: colors.background.elevated, borderColor: colors.materials.border },
            ]}
          >
            <Text style={[completeSt.scoreNum, { color: accentColor }]}>
              {correct}/{total}
            </Text>
            <Text style={[completeSt.scoreLabel, { color: colors.text.tertiary }]}>
              {t('quiz.score', { pct })}
            </Text>
          </View>
        </Animated.View>

        <View style={completeSt.actions}>
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.85}
            style={[completeSt.btn, { backgroundColor: accentColor }]}
            accessibilityRole="button"
            accessibilityLabel={t('quiz.backToWorlds')}
          >
            <Text style={[completeSt.btnText, { color: '#fff' }]}>{t('quiz.backToWorlds')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenWrapper>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

const EMPTY_QUESTIONS: QuizItem[] = [];

export default function WorldQuizScreen() {
  const { worldId } = useLocalSearchParams<{ worldId: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // Per-account key (Firebase uid); fallback to local profile id in offline/demo mode.
  const firebaseUid = useAuthStore((s) => s.firebaseUid);
  const localProfileId = useUserStore((s) => s.id);
  const userId = firebaseUid ?? localProfileId;

  // Tenant identity (set only for provisioned students). Used to mirror progress
  // to the school tree for the teacher dashboard; no-op when not provisioned.
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);

  const fetchWorldQuestions = useQuestionBankStore((s) => s.fetchWorldQuestions);
  const getWorldProgress = useQuestionBankStore((s) => s.getWorldProgress);
  const recordAnswer = useQuestionBankStore((s) => s.recordAnswer);
  const { t } = useTranslation();

  const questions = useQuestionBankStore(
    (s) => s.questionsByWorld[worldId as WorldId] ?? EMPTY_QUESTIONS
  );
  const fetchStatus = useQuestionBankStore((s) => s.fetchStatus[worldId as WorldId] ?? 'idle');

  // Class config (RQ-PR10/PR11/PR12): custom display name/color + overrides.
  const { config: classConfig } = useClassConfig();
  const configEntry = classConfig?.mundos?.find((m) => m.worldId === worldId);
  const disp = displayWorldDef(worldId ?? '', configEntry);
  const fallback = WORLD_META[worldId ?? ''] ?? { name: 'Mundo', color: '#FF8A1F' };
  const meta = { name: disp?.name ?? fallback.name, color: disp?.color ?? fallback.color };

  // Linear traversal state (R7: no adaptive selection)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Per-question answer state (reset on each new question)
  // For multiple_choice/true_false: selectedOption (string representation)
  // For ordenar: chosenOrder (array of element indices)
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [chosenOrder, setChosenOrder] = useState<number[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Grado resolved from the student's course (R4 — never stored on the minor).
  // null while resolving so we never fetch the wrong grade's banco (works for
  // direct deep-link navigation too, not just via WorldsScreen).
  const grado = useStudentGrado();

  // Fetch once the grade is known. The store guard keys on (grado, seedKey,
  // config version), so this assembles the correct grade's 10 items for this
  // student and picks up the course's custom copies when flagged (RQ-PR11).
  useEffect(() => {
    if (!worldId || !grado) return;
    const courseContent =
      colegioId && cursoId
        ? {
            colegioId,
            cursoId,
            overrides: classConfig?.overrides?.[worldId],
            version: classConfig?.version ?? 0,
          }
        : null;
    void fetchWorldQuestions(grado, worldId as WorldId, userId ?? 'demo', courseContent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId, grado, userId, colegioId, cursoId, classConfig?.version]);

  // On completion, mirror progress to the tenant tree for the teacher dashboard.
  useEffect(() => {
    if (!isComplete) return;
    if (role !== 'estudiante' || !colegioId || !cursoId || !firebaseUid || !worldId) return;
    const { done, total } = getWorldProgress(userId ?? '', worldId as WorldId);
    if (total <= 0) return;
    const progress = buildWorldProgress({
      colegioId,
      cursoId,
      uid: firebaseUid,
      worldId: worldId as WorldId,
      correct: done,
      total,
      // Custom worlds (RQ-PR12 CA2): the professor-assigned competency (or
      // 'personalizada' via the builder's fallback). Default worlds ignore it.
      competencia: configEntry?.competencia,
      now: Date.now(),
    });
    void worldProgressRepository.upsert(colegioId, cursoId, firebaseUid, worldId, progress);
  }, [
    isComplete,
    role,
    colegioId,
    cursoId,
    firebaseUid,
    worldId,
    userId,
    getWorldProgress,
    configEntry?.competencia,
  ]);

  const currentQuestion = questions[currentIndex] ?? null;

  // Derived: has the student provided a full answer for the current item?
  const hasAnswer = useMemo(() => {
    if (!currentQuestion) return false;
    if (currentQuestion.tipo === 'ordenar') {
      return chosenOrder.length === currentQuestion.elementos.length;
    }
    return selectedOption !== null;
  }, [currentQuestion, selectedOption, chosenOrder]);

  // Derived: is the current submitted answer correct?
  const isCorrect = useMemo<boolean | null>(() => {
    if (!hasSubmitted || !currentQuestion) return null;
    switch (currentQuestion.tipo) {
      case 'multiple_choice':
        return (
          selectedOption !== null && isMCCorrect(currentQuestion, parseInt(selectedOption, 10))
        );
      case 'true_false':
        return selectedOption !== null && isTFCorrect(currentQuestion, selectedOption === 'true');
      case 'ordenar':
        return isOrdenarCorrect(currentQuestion, chosenOrder);
      default:
        return false;
    }
  }, [hasSubmitted, currentQuestion, selectedOption, chosenOrder]);

  const handleSubmit = () => {
    if (!hasAnswer || !currentQuestion || !userId || hasSubmitted) return;

    let correct = false;
    switch (currentQuestion.tipo) {
      case 'multiple_choice':
        correct =
          selectedOption !== null && isMCCorrect(currentQuestion, parseInt(selectedOption, 10));
        break;
      case 'true_false':
        correct =
          selectedOption !== null && isTFCorrect(currentQuestion, selectedOption === 'true');
        break;
      case 'ordenar':
        correct = isOrdenarCorrect(currentQuestion, chosenOrder);
        break;
    }

    void Haptics.impactAsync(
      correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy
    );
    recordAnswer(userId, currentQuestion.id, worldId as WorldId, correct);
    setHasSubmitted(true);
  };

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) {
      setIsComplete(true);
    } else {
      setCurrentIndex(nextIndex);
      setSelectedOption(null);
      setChosenOrder([]);
      setHasSubmitted(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (fetchStatus === 'loading' || (fetchStatus === 'idle' && questions.length === 0)) {
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
        <Text style={[{ color: colors.text.tertiary, marginTop: 16 }, Typography.footnote]}>
          {t('quiz.loading')}
        </Text>
      </ScreenWrapper>
    );
  }

  if (fetchStatus === 'error') {
    return (
      <ScreenWrapper
        style={{
          flex: 1,
          backgroundColor: colors.background.base,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <Ionicons name="cloud-offline" size={48} color={colors.text.quaternary} />
        <Text
          style={[
            { color: colors.text.secondary, marginTop: 16, textAlign: 'center' },
            Typography.headline,
          ]}
        >
          {t('quiz.offline')}
        </Text>
        <Text
          style={[
            { color: colors.text.tertiary, marginTop: 8, textAlign: 'center' },
            Typography.footnote,
          ]}
        >
          {t('quiz.offlineHint')}
        </Text>
        <TouchableOpacity
          onPress={handleBack}
          style={{ marginTop: 24 }}
          accessibilityRole="button"
          accessibilityLabel={t('quiz.back')}
        >
          <Text style={[{ color: meta.color }, Typography.headline]}>{t('quiz.back')}</Text>
        </TouchableOpacity>
      </ScreenWrapper>
    );
  }

  // ── Completion ─────────────────────────────────────────────────────────────
  if (isComplete) {
    const { done: worldDone, total: worldTotal } = getWorldProgress(
      userId ?? '',
      worldId as WorldId
    );
    return (
      <CompletionScreen
        worldName={meta.name}
        accentColor={meta.color}
        correct={worldDone}
        total={worldTotal > 0 ? worldTotal : QUESTIONS_PER_WORLD}
        onBack={handleBack}
        colors={colors}
        insetTop={insets.top}
        insetBottom={insets.bottom}
        t={t}
      />
    );
  }

  if (!currentQuestion) return null;

  // ── Quiz ───────────────────────────────────────────────────────────────────
  const isLastQuestion = currentIndex === questions.length - 1;

  return (
    <ScreenWrapper style={{ flex: 1, backgroundColor: colors.background.base }}>
      <QuizHeader
        worldName={meta.name}
        accentColor={meta.color}
        currentIndex={currentIndex}
        total={questions.length}
        onBack={handleBack}
        colors={colors}
        insetTop={insets.top}
        backLabel={t('quiz.back')}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type badge + competencia */}
        <Animated.View entering={FadeIn.duration(200)} style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: colors.materials.highlight }]}>
            <Text style={[styles.badgeText, { color: colors.text.tertiary }]}>
              {currentQuestion.tipo === 'multiple_choice'
                ? t('quiz.tipoMC')
                : currentQuestion.tipo === 'true_false'
                  ? t('quiz.tipoVF')
                  : t('quiz.tipoOrdenar')}
            </Text>
          </View>
          <Text style={[styles.concept, { color: colors.text.quaternary }]} numberOfLines={1}>
            {currentQuestion.competencia}
          </Text>
        </Animated.View>

        {/* Question text */}
        <Animated.View entering={FadeInDown.duration(250).delay(40)}>
          <Text style={[styles.questionText, { color: colors.text.primary }]}>
            {currentQuestion.enunciado}
          </Text>
        </Animated.View>

        {/* ── Answer area per tipo ── */}
        <Animated.View entering={FadeInDown.duration(250).delay(100)} style={styles.options}>
          {currentQuestion.tipo === 'multiple_choice' && (
            <>
              {currentQuestion.opciones.map((opt, idx) => {
                let state: 'idle' | 'selected' | 'correct' | 'wrong' = 'idle';
                if (hasSubmitted) {
                  if (idx === currentQuestion.correctIndex) state = 'correct';
                  else if (String(idx) === selectedOption) state = 'wrong';
                } else if (String(idx) === selectedOption) {
                  state = 'selected';
                }
                return (
                  <OptionButton
                    key={idx}
                    label={opt}
                    state={state}
                    onPress={() => !hasSubmitted && setSelectedOption(String(idx))}
                    colors={colors}
                  />
                );
              })}
            </>
          )}

          {currentQuestion.tipo === 'true_false' && (
            <>
              {(['true', 'false'] as const).map((val) => {
                const label = val === 'true' ? t('quiz.verdadero') : t('quiz.falso');
                const isThisCorrect = currentQuestion.respuesta === (val === 'true');
                let state: 'idle' | 'selected' | 'correct' | 'wrong' = 'idle';
                if (hasSubmitted) {
                  if (isThisCorrect) state = 'correct';
                  else if (val === selectedOption) state = 'wrong';
                } else if (val === selectedOption) {
                  state = 'selected';
                }
                return (
                  <OptionButton
                    key={val}
                    label={label}
                    state={state}
                    onPress={() => !hasSubmitted && setSelectedOption(val)}
                    colors={colors}
                  />
                );
              })}
            </>
          )}

          {currentQuestion.tipo === 'ordenar' && (
            <OrdenarWidget
              item={currentQuestion}
              submitted={hasSubmitted}
              chosen={chosenOrder}
              onChosen={setChosenOrder}
              colors={colors}
              t={t}
            />
          )}
        </Animated.View>

        {/* Feedback */}
        {hasSubmitted && isCorrect !== null && (
          <FeedbackBanner
            isCorrect={isCorrect}
            explanation={currentQuestion.explicacion ?? ''}
            colors={colors}
            t={t}
          />
        )}
      </ScrollView>

      {/* Footer action button */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background.base,
            borderTopColor: colors.materials.border,
            paddingBottom: Math.max(insets.bottom, 16) + 4,
          },
        ]}
      >
        {!hasSubmitted ? (
          <TouchableOpacity
            activeOpacity={hasAnswer ? 0.85 : 0.4}
            onPress={hasAnswer ? handleSubmit : undefined}
            accessibilityRole="button"
            accessibilityLabel={t('quiz.check')}
            accessibilityState={{ disabled: !hasAnswer }}
            style={[
              styles.actionBtn,
              {
                backgroundColor: hasAnswer ? meta.color : colors.materials.highlight,
                opacity: hasAnswer ? 1 : 0.6,
              },
            ]}
          >
            <Text
              style={[styles.actionBtnText, { color: hasAnswer ? '#fff' : colors.text.tertiary }]}
            >
              {t('quiz.check')}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel={isLastQuestion ? t('quiz.result') : t('quiz.next')}
            style={[styles.actionBtn, { backgroundColor: meta.color }]}
          >
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>
              {isLastQuestion ? t('quiz.result') : t('quiz.next')}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </ScreenWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: 120,
    gap: Spacing.base,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  concept: {
    ...Typography.caption1,
    flex: 1,
  },
  questionText: {
    ...Typography.title3,
    fontWeight: '700',
    lineHeight: 28,
  },
  options: {
    gap: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.base,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionBtn: {
    height: 54,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: {
    ...Typography.headline,
    fontWeight: '800',
  },
});

const headerSt = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 2,
  },
  worldLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  counter: {
    fontSize: 11,
    fontWeight: '600',
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});

const optSt = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: 14,
    gap: 10,
  },
  label: {
    ...Typography.body,
    flex: 1,
    lineHeight: 22,
  },
});

const feedbackSt = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    ...Typography.headline,
    fontWeight: '800',
  },
  text: {
    ...Typography.footnote,
    lineHeight: 20,
  },
});

const completeSt = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    justifyContent: 'space-between',
  },
  center: {
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    ...Typography.title1,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.headline,
    textAlign: 'center',
  },
  scoreCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    width: '100%',
  },
  scoreNum: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
  scoreLabel: {
    ...Typography.footnote,
    textAlign: 'center',
  },
  actions: {
    gap: 10,
  },
  btn: {
    height: 54,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    ...Typography.headline,
    fontWeight: '800',
  },
});

const ordenarSt = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  panelLabel: {
    ...Typography.caption1,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  panel: {
    gap: 8,
  },
  emptyHint: {
    ...Typography.footnote,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: 12,
    gap: 8,
  },
  posNum: {
    ...Typography.headline,
    fontWeight: '800',
    minWidth: 20,
  },
  itemText: {
    ...Typography.body,
    flex: 1,
    lineHeight: 20,
  },
});
