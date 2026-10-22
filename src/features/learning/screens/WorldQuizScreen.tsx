/**
 * WorldQuizScreen — static quiz (R7, R9, R11).
 *
 * Traverses the 10 assembled items in order. No adaptive selection (R7). No
 * certificate generation (R11). Vidas (quizVidas): 3 por intento; una respuesta
 * incorrecta cuesta una vida y la pregunta vuelve al final, sin revelar la
 * respuesta ni la explicación. Hay que contestar bien todas; sin vidas, el mundo
 * se empieza desde cero. Supports three item types:
 *   - multiple_choice: tap one of opciones[]
 *   - true_false: tap Verdadero / Falso
 *   - ordenar: tap items in sequence to build an order; submit and compare to
 *     ordenCanonico (never shown before submission — R9)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  cancelAnimation,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  useQuestionBankStore,
  QUESTIONS_PER_WORLD,
} from '@features/learning/store/useQuestionBankStore';
import { CetiAnimation } from '@features/animations';
import { useStudentGrado } from '@features/learning/hooks/useStudentGrado';
import { isMastered } from '@features/learning/data/mastery';
import { useQuizStreakStore } from '@features/learning/store/useQuizStreakStore';
import StreakCelebration from '@features/learning/components/StreakCelebration';
import QuizSinVidas from '@features/learning/components/QuizSinVidas';
import {
  VIDAS_POR_MUNDO,
  estadoIntento,
  nuevoIntento,
  precision,
  preguntaActual,
  registrarRespuesta,
  siguiente,
  type IntentoQuiz,
} from '@features/learning/data/quizVidas';
import { hashStr, stableShuffle } from '@shared/lib/quizUtils';
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
import {
  enterFadeUp,
  enterSlideUp,
  enterSoftFade,
  enterSoftScale,
  pageTiming,
  pressInTiming,
  pressOutTiming,
  pressScale,
  softEasing,
} from '@shared/constants/motion';
import AnimatedProgressFill from '@shared/components/motion/AnimatedProgressFill';
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

/** Rojo de las vidas (el mismo del corazón de lives.corazon). */
const HEART_RED = '#FF4B4B';

/** Con la última vida perdida, tiempo para ver el corazón romperse antes de la pantalla de sin vidas. */
const SIN_VIDAS_DELAY_MS = 1800;

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

/** Respuesta de una pregunta: opción elegida (MC / VF) u orden construido. */
type AnswerState = {
  selectedOption: string | null;
  chosenOrder: number[];
  hasSubmitted: boolean;
};

function isAnswerCorrect(item: QuizItem, answer: AnswerState): boolean {
  switch (item.tipo) {
    case 'multiple_choice':
      return (
        answer.selectedOption !== null && isMCCorrect(item, parseInt(answer.selectedOption, 10))
      );
    case 'true_false':
      return answer.selectedOption !== null && isTFCorrect(item, answer.selectedOption === 'true');
    case 'ordenar':
      return isOrdenarCorrect(item, answer.chosenOrder);
    default:
      return false;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Un corazón de la cabecera. Al perderse, en su lugar se reproduce una vez el corazón que
 * se vacía y se rompe (lives.corazon), y queda partido. Es el único aviso de la vida perdida.
 */
function Corazon({ lleno }: { lleno: boolean }) {
  return (
    <View style={headerSt.corazon}>
      {lleno ? (
        <Ionicons name="heart" size={20} color={HEART_RED} />
      ) : (
        <View style={headerSt.corazonLottie} pointerEvents="none">
          <CetiAnimation id="lives.corazon" size={CORAZON_LOTTIE} />
        </View>
      )}
    </View>
  );
}

/**
 * Lienzo del Lottie (512 px) en el que el corazón mide ~200 px de alto: a 40 px queda de ~16 px,
 * lo mismo que el ícono de 20. Va en su propia caja de tamaño fijo, centrada sobre el hueco del
 * corazón (el dibujo está ~2 px por debajo del centro del lienzo).
 */
const CORAZON_LOTTIE = 40;
const CORAZON_SLOT = 22;

function QuizHeader({
  worldName,
  accentColor,
  aciertos,
  total,
  vidas,
  onBack,
  colors,
  insetTop,
  backLabel,
  livesLabel,
}: {
  worldName: string;
  accentColor: string;
  aciertos: number;
  total: number;
  vidas: number;
  onBack: () => void;
  colors: ThemeColors;
  insetTop: number;
  backLabel: string;
  livesLabel: string;
}) {
  const pct = total > 0 ? (aciertos / total) * 100 : 0;
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
            {aciertos}/{total}
          </Text>
        </View>
        <View style={headerSt.vidas} accessible accessibilityLabel={livesLabel}>
          {Array.from({ length: VIDAS_POR_MUNDO }, (_, i) => (
            <Corazon key={i} lleno={i < vidas} />
          ))}
        </View>
      </View>
      <View style={[headerSt.track, { backgroundColor: colors.materials.highlight }]}>
        <AnimatedProgressFill
          pct={pct}
          duration={320}
          style={[headerSt.fill, { backgroundColor: accentColor }]}
        />
      </View>
    </View>
  );
}

/** `muted`: opción no elegida después de comprobar (no se resalta la correcta). */
type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'muted';

function OptionButton({
  label,
  state,
  onPress,
  colors,
}: {
  label: string;
  state: OptionState;
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
  const interactive = state === 'idle' || state === 'selected';

  // Feedback: escala al presionar, pulso suave si es correcta, sacudida leve si no.
  const scale = useSharedValue(1);
  const shakeX = useSharedValue(0);
  useEffect(() => {
    if (state === 'correct') {
      scale.value = withSequence(
        withTiming(1.03, { duration: 130, easing: softEasing, reduceMotion: ReduceMotion.System }),
        withTiming(1, { duration: 170, easing: softEasing, reduceMotion: ReduceMotion.System })
      );
    } else if (state === 'wrong') {
      const step = { duration: 42, easing: softEasing, reduceMotion: ReduceMotion.System };
      shakeX.value = withSequence(
        withTiming(-4, step),
        withTiming(4, step),
        withTiming(-4, step),
        withTiming(4, step),
        withTiming(-2, step),
        withTiming(0, step)
      );
    }
  }, [state, scale, shakeX]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        activeOpacity={interactive ? 0.75 : 1}
        onPress={interactive ? onPress : undefined}
        onPressIn={() => {
          if (interactive) scale.value = withTiming(pressScale, pressInTiming);
        }}
        onPressOut={() => {
          if (interactive) scale.value = withTiming(1, pressOutTiming);
        }}
        style={[optSt.btn, { backgroundColor: bg, borderColor: border }]}
      >
        <Text style={[optSt.label, { color: textColor }]}>{label}</Text>
        {state === 'correct' && (
          <Ionicons name="checkmark-circle" size={20} color={colors.system.green} />
        )}
        {state === 'wrong' && <Ionicons name="close-circle" size={20} color={colors.system.red} />}
      </TouchableOpacity>
    </Animated.View>
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
      entering={enterSlideUp()}
      style={[feedbackSt.wrap, { backgroundColor: bgColor, borderColor: iconColor }]}
    >
      <View style={feedbackSt.titleRow}>
        <Ionicons name={iconName} size={20} color={iconColor} />
        <Text style={[feedbackSt.title, { color: iconColor }]}>{label}</Text>
      </View>
      {/* Al fallar no se da la respuesta ni la explicación: la pregunta vuelve al final. */}
      {isCorrect && explanation ? (
        <Text style={[feedbackSt.text, { color: colors.text.secondary }]}>{explanation}</Text>
      ) : null}
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
 * After submission, the whole sequence is marked correct or wrong (never per
 * position: that would reveal part of the answer when it is wrong).
 *
 * IMPORTANT: ordenCanonico is NEVER displayed (R9).
 */
function OrdenarWidget({
  item,
  submitted,
  isCorrect,
  chosen,
  onChosen,
  colors,
  t,
}: {
  item: OrdenarItem;
  submitted: boolean;
  isCorrect: boolean;
  chosen: number[];
  onChosen: (indices: number[]) => void;
  colors: ThemeColors;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const displayOrder = useMemo(() => {
    const base = item.elementos.map((el, idx) => ({ el, idx }));
    const shuffled = stableShuffle(base, hashStr(item.id));
    // Si el barajado coincide con el orden correcto, rotamos para no regalar la respuesta.
    const solved = shuffled.every(({ idx }, pos) => item.ordenCanonico[pos] === idx);
    return solved && shuffled.length > 1 ? [...shuffled.slice(1), shuffled[0]] : shuffled;
  }, [item]);
  const available = displayOrder.filter(({ idx }) => !chosen.includes(idx));

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
            if (submitted) state = isCorrect ? 'correct' : 'wrong';
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

// ─── Página de pregunta ───────────────────────────────────────────────────────

/**
 * Todo lo que cambia entre preguntas (tipo, enunciado, opciones, feedback) en
 * un solo bloque, para que se deslice como una pieza. Lo fijo (cabecera,
 * progreso, botón de abajo) vive fuera.
 */
function QuestionPage({
  question,
  answer,
  onSelect,
  onChosen,
  colors,
  t,
}: {
  question: QuizItem;
  answer: AnswerState;
  onSelect: (value: string) => void;
  onChosen: (indices: number[]) => void;
  colors: ThemeColors;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const { selectedOption, chosenOrder, hasSubmitted } = answer;
  const isCorrect = hasSubmitted && isAnswerCorrect(question, answer);
  // Tras comprobar solo se marca la opción elegida; la correcta nunca se revela al fallar.
  const optionState = (value: string): OptionState => {
    if (value !== selectedOption) return hasSubmitted ? 'muted' : 'idle';
    if (!hasSubmitted) return 'selected';
    return isCorrect ? 'correct' : 'wrong';
  };
  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Question type */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: colors.materials.highlight }]}>
          <Text style={[styles.badgeText, { color: colors.text.tertiary }]}>
            {question.tipo === 'multiple_choice'
              ? t('quiz.tipoMC')
              : question.tipo === 'true_false'
                ? t('quiz.tipoVF')
                : t('quiz.tipoOrdenar')}
          </Text>
        </View>
      </View>

      {/* Question text */}
      <Text style={[styles.questionText, { color: colors.text.primary }]}>
        {question.enunciado}
      </Text>

      {/* ── Answer area per tipo ── */}
      <View style={styles.options}>
        {question.tipo === 'multiple_choice' &&
          stableShuffle(
            question.opciones.map((opt, idx) => ({ opt, idx })),
            hashStr(question.id)
          ).map(({ opt, idx }) => (
            <OptionButton
              key={idx}
              label={opt}
              state={optionState(String(idx))}
              onPress={() => onSelect(String(idx))}
              colors={colors}
            />
          ))}

        {question.tipo === 'true_false' &&
          (['true', 'false'] as const).map((val) => (
            <OptionButton
              key={val}
              label={val === 'true' ? t('quiz.verdadero') : t('quiz.falso')}
              state={optionState(val)}
              onPress={() => onSelect(val)}
              colors={colors}
            />
          ))}

        {question.tipo === 'ordenar' && (
          <OrdenarWidget
            item={question}
            submitted={hasSubmitted}
            isCorrect={isCorrect}
            chosen={chosenOrder}
            onChosen={onChosen}
            colors={colors}
            t={t}
          />
        )}
      </View>

      {/* Feedback */}
      {hasSubmitted && (
        <FeedbackBanner
          isCorrect={isCorrect}
          explanation={question.explicacion ?? ''}
          colors={colors}
          t={t}
        />
      )}
    </ScrollView>
  );
}

/**
 * Ranura de un pager: la página `index` vive en x = (index − pos) · ancho.
 * Mover `pos` desplaza todas las páginas a la vez y a la misma velocidad
 * (la que sale y la que entra quedan pegadas), sin fade ni parallax.
 */
function PageSlot({
  index,
  pos,
  pageW,
  active,
  children,
}: {
  index: number;
  pos: SharedValue<number>;
  pageW: SharedValue<number>;
  active: boolean;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: (index - pos.get()) * pageW.get() }],
  }));
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </Animated.View>
  );
}

// ─── CompletionScreen ─────────────────────────────────────────────────────────

function CompletionScreen({
  worldName,
  accentColor,
  correct,
  total,
  pct,
  mastered,
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
  /** Precisión del intento: aciertos sobre respuestas enviadas. */
  pct: number;
  mastered: boolean;
  onBack: () => void;
  colors: ThemeColors;
  insetTop: number;
  insetBottom: number;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
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
        <Animated.View entering={enterSoftFade()} style={completeSt.center}>
          <Animated.View
            entering={enterSoftScale(60)}
            style={[completeSt.iconCircle, { backgroundColor: accentColor + '22' }]}
          >
            <Ionicons name={mastered ? 'trophy' : 'refresh'} size={52} color={accentColor} />
          </Animated.View>
          <Text style={[completeSt.title, { color: colors.text.primary }]}>
            {mastered ? t('quiz.worldComplete') : t('quiz.tryAgainTitle')}
          </Text>
          <Text style={[completeSt.subtitle, { color: colors.text.secondary }]}>
            {mastered ? worldName : t('quiz.needToUnlock')}
          </Text>
          <Animated.View
            entering={enterFadeUp(2, 40)}
            style={[
              completeSt.scoreCard,
              { backgroundColor: colors.background.elevated, borderColor: colors.materials.border },
            ]}
          >
            <Animated.Text
              entering={enterSoftScale(180)}
              style={[completeSt.scoreNum, { color: accentColor }]}
            >
              {correct}/{total}
            </Animated.Text>
            <Text style={[completeSt.scoreLabel, { color: colors.text.tertiary }]}>
              {t('quiz.score', { pct })}
            </Text>
          </Animated.View>
        </Animated.View>

        <Animated.View entering={enterFadeUp(3, 40)} style={completeSt.actions}>
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.85}
            style={[completeSt.btn, { backgroundColor: accentColor }]}
            accessibilityRole="button"
            accessibilityLabel={t('quiz.backToWorlds')}
          >
            <Text style={[completeSt.btnText, { color: '#fff' }]}>{t('quiz.backToWorlds')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </ScreenWrapper>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

const EMPTY_QUESTIONS: QuizItem[] = [];

/** Velocidad (px/s) a partir de la cual un deslizamiento corto ya cambia de pregunta. */
const SWIPE_VELOCITY = 500;

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

  // Intento con vidas (R7: sin selección adaptativa; las falladas vuelven al final de la cola).
  // Se crea al tener las preguntas y se reinicia si cambia el banco cargado.
  const [intentoState, setIntento] = useState<IntentoQuiz | null>(null);
  const intento =
    intentoState && intentoState.total === questions.length
      ? intentoState
      : nuevoIntento(questions.length);
  const estado = estadoIntento(intento);
  const currentIndex = intento.pos;
  const [isComplete, setIsComplete] = useState(false);
  const [celebracion, setCelebracion] = useState<number | null>(null);
  const registrarQuiz = useQuizStreakStore((s) => s.registrarQuiz);
  // Al perder la última vida se deja ver el corazón romperse en la esquina y luego sale la pantalla de sin vidas.
  const [sinVidas, setSinVidas] = useState(false);
  const sinVidasTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (sinVidasTimer.current) clearTimeout(sinVidasTimer.current);
    },
    []
  );

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

  const currentQuestion = questions[preguntaActual(intento) ?? -1] ?? null;

  // Derived: has the student provided a full answer for the current item?
  const hasAnswer = useMemo(() => {
    if (!currentQuestion) return false;
    if (currentQuestion.tipo === 'ordenar') {
      return chosenOrder.length === currentQuestion.elementos.length;
    }
    return selectedOption !== null;
  }, [currentQuestion, selectedOption, chosenOrder]);

  // ── Pager entre preguntas ──────────────────────────────────────────────────
  // `pos` es la pregunta en pantalla (fraccionaria mientras se desliza). La
  // pregunta `i` vive en x = (i − pos) · ancho, así que todas se mueven juntas.
  // `viewIndex` ≤ `currentIndex`: hacia atrás se repasan las ya respondidas
  // (solo lectura); hacia adelante nunca se pasa de la pregunta actual.
  const { width: windowW } = useWindowDimensions();
  const pageW = useSharedValue(windowW);
  const pos = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const maxIndex = useSharedValue(0);
  const [viewIndex, setViewIndex] = useState(0);
  const [history, setHistory] = useState<AnswerState[]>([]);
  const handlePagerLayout = (e: LayoutChangeEvent) => {
    pageW.set(e.nativeEvent.layout.width);
  };
  useEffect(() => {
    maxIndex.set(currentIndex);
  }, [currentIndex, maxIndex]);

  const goTo = (index: number) => {
    setViewIndex(index);
    pos.set(withTiming(index, pageTiming));
  };

  const swipe = useMemo(
    () =>
      Gesture.Pan()
        // Solo horizontal: el scroll vertical de la pregunta sigue funcionando.
        .activeOffsetX([-12, 12])
        .failOffsetY([-12, 12])
        .onStart(() => {
          cancelAnimation(pos);
          dragStart.set(pos.get());
        })
        .onUpdate((e) => {
          const max = maxIndex.get();
          let next = dragStart.get() - e.translationX / pageW.get();
          // Resistencia en los bordes (antes de la 1.ª y después de la actual).
          if (next < 0) next = next / 3;
          else if (next > max) next = max + (next - max) / 3;
          pos.set(next);
        })
        .onEnd((e) => {
          const w = pageW.get();
          const from = Math.round(dragStart.get());
          const delta = dragStart.get() - e.translationX / w - from;
          let target = from;
          // Basta un movimiento rápido o pasar la mitad de la página.
          if (Math.abs(e.velocityX) > SWIPE_VELOCITY) target = from - Math.sign(e.velocityX);
          else if (Math.abs(delta) > 0.5) target = from + Math.sign(delta);
          target = Math.min(Math.max(target, 0), maxIndex.get());
          pos.set(
            withSpring(target, {
              duration: 400,
              dampingRatio: 1,
              overshootClamping: true,
              velocity: -e.velocityX / w,
              reduceMotion: ReduceMotion.System,
            })
          );
          scheduleOnRN(setViewIndex, target);
          if (target !== from) scheduleOnRN(Haptics.selectionAsync);
        }),
    [pos, dragStart, maxIndex, pageW]
  );

  const handleSubmit = () => {
    if (!hasAnswer || !currentQuestion || !userId || hasSubmitted) return;

    const correct = isAnswerCorrect(currentQuestion, {
      selectedOption,
      chosenOrder,
      hasSubmitted,
    });

    void Haptics.impactAsync(
      correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy
    );
    const despues = registrarRespuesta(intento, correct);
    setIntento(despues);
    setHasSubmitted(true);
    if (estadoIntento(despues) === 'perdido') {
      sinVidasTimer.current = setTimeout(() => setSinVidas(true), SIN_VIDAS_DELAY_MS);
    }
  };

  const handleNext = () => {
    if (estado === 'perdido') {
      if (sinVidasTimer.current) clearTimeout(sinVidasTimer.current);
      setSinVidas(true);
      return;
    }
    if (estado === 'completado') {
      // El progreso solo cuenta al terminar el mundo: un intento perdido empieza de cero.
      if (userId) {
        for (const q of questions) recordAnswer(userId, q.id, worldId as WorldId, true);
        const { primeroHoy, racha } = registrarQuiz(userId);
        if (primeroHoy) setCelebracion(racha);
      }
      setIsComplete(true);
      return;
    }
    const nextIndex = currentIndex + 1;
    setHistory((h) => {
      const next = [...h];
      next[currentIndex] = { selectedOption, chosenOrder, hasSubmitted };
      return next;
    });
    setIntento(siguiente(intento));
    setSelectedOption(null);
    setChosenOrder([]);
    setHasSubmitted(false);
    goTo(nextIndex);
  };

  /** Sin vidas: el mundo empieza otra vez desde la primera pregunta, con 3 vidas. */
  const handleRestart = () => {
    setSinVidas(false);
    setIntento(nuevoIntento(questions.length));
    setHistory([]);
    setSelectedOption(null);
    setChosenOrder([]);
    setHasSubmitted(false);
    setViewIndex(0);
    pos.set(0);
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/saga');
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
      <>
        <CompletionScreen
          worldName={meta.name}
          accentColor={meta.color}
          correct={intento.aciertos}
          total={questions.length > 0 ? questions.length : QUESTIONS_PER_WORLD}
          pct={precision(intento)}
          mastered={isMastered(worldDone, worldTotal > 0 ? worldTotal : QUESTIONS_PER_WORLD)}
          onBack={handleBack}
          colors={colors}
          insetTop={insets.top}
          insetBottom={insets.bottom}
          t={t}
        />
        <StreakCelebration
          racha={celebracion ?? 0}
          visible={celebracion !== null}
          onClose={() => setCelebracion(null)}
        />
      </>
    );
  }

  // ── Sin vidas (después de ver el corazón romperse) ────────────────────────
  if (estado === 'perdido' && sinVidas) {
    return (
      <QuizSinVidas
        worldName={meta.name}
        accentColor={meta.color}
        insetTop={insets.top}
        insetBottom={insets.bottom}
        onRetry={handleRestart}
        onBack={handleBack}
      />
    );
  }

  if (!currentQuestion) return null;

  // ── Quiz ───────────────────────────────────────────────────────────────────
  const isLastQuestion = estado === 'completado';
  const reviewing = viewIndex < currentIndex;

  return (
    <ScreenWrapper style={{ flex: 1, backgroundColor: colors.background.base }}>
      <QuizHeader
        worldName={meta.name}
        accentColor={meta.color}
        aciertos={intento.aciertos}
        total={questions.length}
        vidas={intento.vidas}
        onBack={handleBack}
        colors={colors}
        insetTop={insets.top}
        backLabel={t('quiz.back')}
        livesLabel={t('quiz.livesA11y', { count: intento.vidas })}
      />

      {/* Preguntas: pager horizontal. Se montan la visible y sus vecinas; al
          deslizar (dedo o botón) todas se mueven juntas. */}
      <GestureDetector gesture={swipe}>
        <View style={styles.pager} onLayout={handlePagerLayout}>
          {[viewIndex - 1, viewIndex, viewIndex + 1]
            .filter((i) => i >= 0 && i <= currentIndex && questions[intento.cola[i]])
            .map((i) => {
              const isCurrent = i === currentIndex;
              const answer = isCurrent ? { selectedOption, chosenOrder, hasSubmitted } : history[i];
              if (!answer) return null;
              return (
                <PageSlot key={i} index={i} pos={pos} pageW={pageW} active={i === viewIndex}>
                  <QuestionPage
                    question={questions[intento.cola[i]]}
                    answer={answer}
                    onSelect={(value) => isCurrent && !hasSubmitted && setSelectedOption(value)}
                    onChosen={isCurrent ? setChosenOrder : () => {}}
                    colors={colors}
                    t={t}
                  />
                </PageSlot>
              );
            })}
        </View>
      </GestureDetector>

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
        {reviewing ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => goTo(currentIndex)}
            accessibilityRole="button"
            accessibilityLabel={t('quiz.backToCurrent')}
            style={[styles.actionBtn, styles.reviewBtn, { borderColor: meta.color }]}
          >
            <Text style={[styles.actionBtnText, { color: meta.color }]}>
              {t('quiz.backToCurrent')}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={meta.color} />
          </TouchableOpacity>
        ) : !hasSubmitted ? (
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
  pager: {
    flex: 1,
    overflow: 'hidden',
  },
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
  reviewBtn: {
    borderWidth: 2,
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
  vidas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  corazon: {
    width: CORAZON_SLOT,
    height: CORAZON_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  corazonLottie: {
    position: 'absolute',
    width: CORAZON_LOTTIE,
    height: CORAZON_LOTTIE,
    left: (CORAZON_SLOT - CORAZON_LOTTIE) / 2,
    top: (CORAZON_SLOT - CORAZON_LOTTIE) / 2 - 2,
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
