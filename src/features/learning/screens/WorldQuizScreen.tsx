import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useQuestionBankStore } from '@features/learning/store/useQuestionBankStore';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { buildWorldProgress } from '@features/learning/data/worldProgress';
import { worldProgressRepository } from '@features/dashboard/data/worldProgressRepository';
import { colegioRepository } from '@features/dashboard/data/colegioRepository';
import { competenciaForWorld } from '@features/learning/data/competencias';
import { isMastered } from '@features/learning/data/mastery';
import { selectNextQuestion, type AnswerResult } from '@features/learning/data/adaptiveQuiz';
import { buildCertificateHtml } from '@features/learning/data/certificate';
import { printHtml } from '@shared/lib/export/downloadFile';
import { useRewards } from '@shared/hooks/useRewards';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { Typography } from '@shared/constants/typography';
import { Spacing, BorderRadius } from '@shared/constants/theme';
import type { QuestionBankItem, WorldId } from '@features/learning/data/questionBank.types';
import type { ThemeColors } from '@shared/constants/colors';

// ─── World metadata ───────────────────────────────────────────────────────────

const WORLD_META: Record<string, { name: string; color: string }> = {
  world_1: { name: 'Planeta Origen', color: '#FF8A1F' },
  world_2: { name: 'Luna del Presupuesto', color: '#F7C95F' },
  world_3: { name: 'Estrella del Ahorro', color: '#58C88C' },
  world_4: { name: 'Nebulosa del Crédito', color: '#A884FF' },
  world_5: { name: 'Agujero Negro de las Deudas', color: '#5B9EF5' },
};

// ─── Option generation utilities ──────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function stableShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    const j = Math.abs(s) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getCalculationOptions(q: QuestionBankItem): string[] {
  const correct = q.content.correctAnswer;
  const seed = hashStr(q.id);

  // Match dollar amounts like "$300,000" or "$2,340,000"
  const dollarAmounts = [...correct.matchAll(/\$([\d,]+)/g)];
  if (dollarAmounts.length > 0) {
    const firstMatch = dollarAmounts[0];
    const num = parseInt(firstMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      const fmtCOP = (n: number) =>
        `$${Math.round(n / 1000) * 1000}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const makeVariant = (mult: number) => correct.replace(firstMatch[0], fmtCOP(num * mult));
      return stableShuffle([correct, makeVariant(0.75), makeVariant(1.25), makeVariant(0.5)], seed);
    }
  }

  // Match "X meses"
  const mesesMatch = correct.match(/^(\d+) meses?$/);
  if (mesesMatch) {
    const n = parseInt(mesesMatch[1], 10);
    return stableShuffle(
      [correct, `${Math.round(n * 0.5)} meses`, `${Math.round(n * 1.5)} meses`, `${n + 2} meses`],
      seed
    );
  }

  return [correct, 'No corresponde', 'Dato insuficiente', 'Ninguna de las anteriores'];
}

function getFillBlankOptions(q: QuestionBankItem): string[] {
  const correct = q.content.correctAnswer; // "word1, word2"
  const correctWords = correct.split(', ').map((w) => w.trim());
  const otherWords = q.content.options.filter((o) => !correctWords.includes(o));
  const seed = hashStr(q.id);

  const distractors: string[] = [];
  // Generate combos from the other words
  for (let i = 0; i + 1 < otherWords.length && distractors.length < 3; i += 2) {
    distractors.push(`${otherWords[i]} / ${otherWords[i + 1]}`);
  }
  // Mix correct[0] with wrong[1] if needed
  if (distractors.length < 3 && otherWords.length > 0) {
    const mix = `${correctWords[0]} / ${otherWords[0]}`;
    if (mix !== correctWords.join(' / ')) distractors.push(mix);
  }
  while (distractors.length < 3) distractors.push(`${otherWords[0] ?? '?'} / ?`);

  return stableShuffle([correctWords.join(' / '), ...distractors.slice(0, 3)], seed);
}

function getOptions(q: QuestionBankItem): string[] {
  switch (q.type) {
    case 'multiple_choice':
      return q.content.options;
    case 'true_false':
      return ['Verdadero', 'Falso'];
    case 'fill_blank':
      return getFillBlankOptions(q);
    case 'calculation':
      return getCalculationOptions(q);
    default:
      return q.content.options;
  }
}

function isAnswerCorrect(selected: string, q: QuestionBankItem): boolean {
  if (q.type === 'fill_blank') {
    const selectedWords = selected.split(' / ').map((w) => w.trim());
    const correctWords = q.content.correctAnswer.split(', ').map((w) => w.trim());
    return (
      selectedWords.length === correctWords.length &&
      selectedWords.every((w, i) => w === correctWords[i])
    );
  }
  return selected === q.content.correctAnswer;
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

function CompletionScreen({
  worldName,
  accentColor,
  correct,
  total,
  onBack,
  canCertify,
  onCertificate,
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
  canCertify: boolean;
  onCertificate: () => void;
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
          {canCertify && (
            <TouchableOpacity
              onPress={onCertificate}
              activeOpacity={0.85}
              style={[completeSt.certBtn, { borderColor: accentColor }]}
              accessibilityRole="button"
              accessibilityLabel={t('quiz.downloadCertificate')}
            >
              <Ionicons name="ribbon-outline" size={18} color={accentColor} />
              <Text style={[completeSt.certText, { color: accentColor }]}>
                {t('quiz.downloadCertificate')}
              </Text>
            </TouchableOpacity>
          )}
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

const EMPTY_QUESTIONS: QuestionBankItem[] = [];

export default function WorldQuizScreen() {
  const { worldId } = useLocalSearchParams<{ worldId: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  // Key progress by the Firebase auth uid (unique per account). The local
  // useUserStore.id is a device-local profile id shared across accounts on the
  // same browser, which mixed different users' progress. Fallback to it only in
  // offline/local mode (no Firebase user). Both hooks run every render.
  const firebaseUid = useAuthStore((s) => s.firebaseUid);
  const localProfileId = useUserStore((s) => s.id);
  const userId = firebaseUid ?? localProfileId;
  const xp = useUserStore((s) => s.xp);
  const level = useUserStore((s) => s.level);
  const nickname = useUserStore((s) => s.nickname);

  // Tenant identity (set only for provisioned students). Used to mirror progress
  // to the school tree for the teacher dashboard; no-op when not provisioned.
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const studentId = useAuthStore((s) => s.studentId);

  const fetchWorldQuestions = useQuestionBankStore((s) => s.fetchWorldQuestions);
  const getWorldProgress = useQuestionBankStore((s) => s.getWorldProgress);
  const recordAnswer = useQuestionBankStore((s) => s.recordAnswer);
  const { checkBadges } = useRewards();
  const { t } = useTranslation();
  const questions = useQuestionBankStore(
    (s) => s.questionsByWorld[worldId as WorldId] ?? EMPTY_QUESTIONS
  );
  const fetchStatus = useQuestionBankStore((s) => s.fetchStatus[worldId as WorldId] ?? 'idle');
  const answers = useQuestionBankStore((s) => s.answers);
  const answeredIds = useMemo(
    () =>
      new Set(
        answers
          .filter(
            (a) => a.uid === (userId ?? '') && a.worldId === (worldId as WorldId) && a.isCorrect
          )
          .map((a) => a.questionId)
      ),
    [answers, userId, worldId]
  );

  const meta = WORLD_META[worldId ?? ''] ?? { name: 'Mundo', color: '#FF8A1F' };

  // Pre-compute stable options for all questions once
  const optionsByQuestion = useMemo(
    () => Object.fromEntries(questions.map((q) => [q.id, getOptions(q)])),
    [questions]
  );

  // Quiz state. Adaptive engine: `currentId` is the shown question, `consumed`
  // are the questions done this session, `results` drives the difficulty ladder.
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [consumed, setConsumed] = useState<string[]>([]);
  const [results, setResults] = useState<AnswerResult[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [certBusy, setCertBusy] = useState(false);

  useEffect(() => {
    if (worldId) void fetchWorldQuestions(worldId as WorldId);
  }, [worldId]);

  // Seed already-correct questions as consumed (so re-entry skips them), then pick
  // the first question adaptively (rule-based difficulty ladder — no AI).
  useEffect(() => {
    if (questions.length === 0) return;
    const seed = questions.filter((q) => answeredIds.has(q.id)).map((q) => q.id);
    const first = selectNextQuestion(questions, new Set(seed), []);
    setConsumed(seed);
    setResults([]);
    if (!first) {
      setIsComplete(true);
    } else {
      setCurrentId(first.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.length]);

  // On completion, mirror progress to the tenant tree for the teacher dashboard.
  // Best-effort: only for provisioned students; rules also gate on estado=='activo'.
  useEffect(() => {
    if (!isComplete) return;
    if (role !== 'estudiante' || !colegioId || !cursoId || !studentId || !worldId) return;
    const { done, total } = getWorldProgress(userId ?? '', worldId as WorldId);
    if (total <= 0) return;
    const progress = buildWorldProgress({
      colegioId,
      cursoId,
      studentId,
      worldId: worldId as WorldId,
      correct: done,
      total,
      xp,
      nivel: level,
      now: Date.now(),
    });
    void worldProgressRepository.upsert(colegioId, cursoId, studentId, worldId, progress);
  }, [
    isComplete,
    role,
    colegioId,
    cursoId,
    studentId,
    worldId,
    userId,
    xp,
    level,
    getWorldProgress,
  ]);

  // Award mastery/achievement badges on completion (idempotent — skips already
  // unlocked). Runs for every student, not just provisioned ones (gamification).
  useEffect(() => {
    if (!isComplete) return;
    checkBadges();
  }, [isComplete, checkBadges]);

  const currentQuestion = questions.find((q) => q.id === currentId) ?? null;
  const options = currentQuestion ? (optionsByQuestion[currentQuestion.id] ?? []) : [];
  // The question that would follow the current one (null = current is the last).
  const nextAfterCurrent = currentQuestion
    ? selectNextQuestion(questions, new Set([...consumed, currentQuestion.id]), results)
    : null;

  const handleSelect = (option: string) => {
    if (hasSubmitted) return;
    setSelectedAnswer(option);
  };

  const handleSubmit = () => {
    if (!selectedAnswer || !currentQuestion || !userId) return;
    const correct = isAnswerCorrect(selectedAnswer, currentQuestion);
    void Haptics.impactAsync(
      correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy
    );
    recordAnswer(userId, currentQuestion.id, worldId as WorldId, correct);
    setResults((prev) => [...prev, { difficulty: currentQuestion.difficulty, correct }]);
    setHasSubmitted(true);
  };

  const handleNext = () => {
    if (!currentQuestion) return;
    const newConsumed = [...consumed, currentQuestion.id];
    setConsumed(newConsumed);
    const next = selectNextQuestion(questions, new Set(newConsumed), results);
    if (!next) {
      setIsComplete(true);
    } else {
      setCurrentId(next.id);
      setSelectedAnswer(null);
      setHasSubmitted(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
  };

  // Certificate is earned when the world is mastered (achievement, not time).
  const { done: worldDone, total: worldTotal } = getWorldProgress(userId ?? '', worldId as WorldId);
  const canCertify = isMastered(worldDone, worldTotal);

  const handleCertificate = async () => {
    if (certBusy) return; // guard against double-print while the colegio loads
    setCertBusy(true);
    try {
      // The colegio name/logo is best-effort: a fetch failure must not block the
      // certificate — fall back to the product name.
      let colegio: Awaited<ReturnType<typeof colegioRepository.getColegio>> = null;
      try {
        colegio = colegioId ? await colegioRepository.getColegio(colegioId) : null;
      } catch {
        colegio = null;
      }
      const html = buildCertificateHtml({
        colegioNombre: colegio?.nombre ?? 'Ceti',
        colegioLogoUrl: colegio?.logoUrl,
        studentName: nickname || 'Estudiante',
        competenciaLabel: competenciaForWorld(worldId as WorldId).label,
        worldName: meta.name,
        masteryPct: worldTotal > 0 ? Math.round((worldDone / worldTotal) * 100) : 0,
        dateLabel: new Date().toLocaleDateString('es-CO', { dateStyle: 'long' }),
      });
      if (!printHtml(html)) {
        Alert.alert(t('learning.certificateTitle'), t('learning.certificateWebOnly'));
      }
    } finally {
      setCertBusy(false);
    }
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
    return (
      <CompletionScreen
        worldName={meta.name}
        accentColor={meta.color}
        correct={worldDone}
        total={worldTotal > 0 ? worldTotal : questions.length}
        onBack={handleBack}
        canCertify={canCertify}
        onCertificate={() => void handleCertificate()}
        colors={colors}
        insetTop={insets.top}
        insetBottom={insets.bottom}
        t={t}
      />
    );
  }

  if (!currentQuestion) return null;

  const isCorrect =
    hasSubmitted && selectedAnswer ? isAnswerCorrect(selectedAnswer, currentQuestion) : null;

  // ── Quiz ───────────────────────────────────────────────────────────────────
  return (
    <ScreenWrapper style={{ flex: 1, backgroundColor: colors.background.base }}>
      <QuizHeader
        worldName={meta.name}
        accentColor={meta.color}
        currentIndex={consumed.length}
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
        {/* Difficulty badge */}
        <Animated.View entering={FadeIn.duration(200)} style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: colors.materials.highlight }]}>
            <Text style={[styles.badgeText, { color: colors.text.tertiary }]}>
              {currentQuestion.difficulty === 'basic'
                ? t('quiz.difficultyBasic')
                : currentQuestion.difficulty === 'intermediate'
                  ? t('quiz.difficultyIntermediate')
                  : t('quiz.difficultyAdvanced')}
            </Text>
          </View>
          <Text style={[styles.concept, { color: colors.text.quaternary }]} numberOfLines={1}>
            {currentQuestion.concept}
          </Text>
        </Animated.View>

        {/* Question text */}
        <Animated.View entering={FadeInDown.duration(250).delay(40)}>
          <Text style={[styles.questionText, { color: colors.text.primary }]}>
            {currentQuestion.content.question}
          </Text>
        </Animated.View>

        {/* Options */}
        <Animated.View entering={FadeInDown.duration(250).delay(100)} style={styles.options}>
          {options.map((opt) => {
            let state: 'idle' | 'selected' | 'correct' | 'wrong' = 'idle';
            if (hasSubmitted) {
              const optIsCorrect = isAnswerCorrect(opt, currentQuestion);
              if (optIsCorrect) state = 'correct';
              else if (opt === selectedAnswer) state = 'wrong';
            } else if (opt === selectedAnswer) {
              state = 'selected';
            }
            return (
              <OptionButton
                key={opt}
                label={opt}
                state={state}
                onPress={() => handleSelect(opt)}
                colors={colors}
              />
            );
          })}
        </Animated.View>

        {/* Feedback */}
        {hasSubmitted && isCorrect !== null && (
          <FeedbackBanner
            isCorrect={isCorrect}
            explanation={currentQuestion.content.explanation}
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
            activeOpacity={selectedAnswer ? 0.85 : 0.4}
            onPress={selectedAnswer ? handleSubmit : undefined}
            accessibilityRole="button"
            accessibilityLabel={t('quiz.check')}
            accessibilityState={{ disabled: !selectedAnswer }}
            style={[
              styles.actionBtn,
              {
                backgroundColor: selectedAnswer ? meta.color : colors.materials.highlight,
                opacity: selectedAnswer ? 1 : 0.6,
              },
            ]}
          >
            <Text
              style={[
                styles.actionBtnText,
                { color: selectedAnswer ? '#fff' : colors.text.tertiary },
              ]}
            >
              {t('quiz.check')}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel={!nextAfterCurrent ? t('quiz.result') : t('quiz.next')}
            style={[styles.actionBtn, { backgroundColor: meta.color }]}
          >
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>
              {!nextAfterCurrent ? t('quiz.result') : t('quiz.next')}
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
  certBtn: {
    height: 50,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  certText: {
    ...Typography.headline,
    fontWeight: '700',
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
