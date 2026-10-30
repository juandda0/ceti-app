/**
 * LeccionScreen — juega una lección, el jefe de un planeta o el primer vuelo.
 *
 * Recorre las preguntas en orden (R7: nada adaptativo). Una respuesta incorrecta
 * muestra la correcta y por qué, y la pregunta vuelve al final de la cola: hay
 * que contestar bien todas. Las lecciones no tienen vidas; el jefe tiene 3 y sin
 * vidas se empieza de nuevo. Cada acierto suma XP, con combo desde 5 seguidos.
 * Al terminar entrega el resultado a quien la abrió (el cierre y las
 * recompensas viven afuera). Tipos de pregunta:
 *   - multiple_choice: tocar una de opciones[]
 *   - true_false: Verdadero / Falso
 *   - ordenar: tocar los elementos en orden y comprobar contra ordenCanonico
 *     (que nunca se muestra antes de responder — R9)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
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
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CetiAnimation } from '@features/animations';
import QuizSinVidas from '@features/learning/components/QuizSinVidas';
import {
  SIN_LIMITE,
  VIDAS_POR_MUNDO,
  acertadasALaPrimera,
  estadoIntento,
  nuevoIntento,
  preguntaActual,
  registrarRespuesta,
  siguiente,
  type IntentoQuiz,
} from '@features/learning/data/quizVidas';
import { hashStr, stableShuffle } from '@shared/lib/quizUtils';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { Typography } from '@shared/constants/typography';
import { Spacing, BorderRadius } from '@shared/constants/theme';
import {
  enterSlideUp,
  pageTiming,
  pressInTiming,
  pressOutTiming,
  pressScale,
  softEasing,
} from '@shared/constants/motion';
import AnimatedProgressFill from '@shared/components/motion/AnimatedProgressFill';
import { COMBO_DESDE, xpRespuesta } from '@features/orbita/domain/progreso';
import { eventos } from '@features/orbita/data/eventos';
import type {
  QuizItem,
  MultipleChoiceItem,
  TrueFalseItem,
  OrdenarItem,
} from '@features/learning/data/quiz.types';
import type { ThemeColors } from '@shared/constants/colors';

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
  titulo,
  accentColor,
  aciertos,
  total,
  vidas,
  xp,
  combo,
  onBack,
  colors,
  insetTop,
  backLabel,
  livesLabel,
  xpLabel,
}: {
  titulo: string;
  accentColor: string;
  aciertos: number;
  total: number;
  vidas: number;
  xp: number;
  combo: number;
  onBack: () => void;
  colors: ThemeColors;
  insetTop: number;
  backLabel: string;
  livesLabel: string;
  xpLabel: string;
}) {
  const pct = total > 0 ? (aciertos / total) * 100 : 0;
  const conVidas = Number.isFinite(vidas);
  const enCombo = combo >= COMBO_DESDE;
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
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={headerSt.center}>
          <Text style={[headerSt.worldLabel, { color: accentColor }]} numberOfLines={1}>
            {titulo}
          </Text>
          <Text style={[headerSt.counter, { color: colors.text.tertiary }]}>
            {aciertos}/{total}
          </Text>
        </View>
        <View style={headerSt.lado}>
          {/* XP siempre visible; el combo lo enciende en naranja. */}
          <View
            style={[
              headerSt.xp,
              { backgroundColor: enCombo ? colors.fill.brandSubtle : colors.materials.highlight },
            ]}
            accessible
            accessibilityLabel={xpLabel}
          >
            <Ionicons
              name="flash"
              size={13}
              color={enCombo ? colors.brand.primary : colors.system.purple}
            />
            <Text
              style={[
                headerSt.xpText,
                { color: enCombo ? colors.brand.primary : colors.text.primary },
              ]}
            >
              {enCombo ? `x${combo}` : xp}
            </Text>
          </View>
          {conVidas && (
            <View style={headerSt.vidas} accessible accessibilityLabel={livesLabel}>
              {Array.from({ length: VIDAS_POR_MUNDO }, (_, i) => (
                <Corazon key={i} lleno={i < vidas} />
              ))}
            </View>
          )}
        </View>
      </View>
      <View style={[headerSt.track, { backgroundColor: colors.materials.highlight }]}>
        <AnimatedProgressFill
          pct={pct}
          duration={320}
          style={[headerSt.fill, { backgroundColor: enCombo ? colors.brand.primary : accentColor }]}
        />
      </View>
    </View>
  );
}

/** `muted`: opción no elegida después de comprobar. `reveal`: la correcta, mostrada tras fallar. */
type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'muted' | 'reveal';

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
    state === 'correct' || state === 'reveal'
      ? colors.system.green
      : state === 'wrong'
        ? colors.system.red
        : state === 'selected'
          ? colors.materials.borderFocus
          : colors.materials.border;
  const textColor =
    state === 'correct' || state === 'reveal'
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
        {state === 'reveal' && (
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.system.green} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function FeedbackBanner({
  isCorrect,
  explanation,
  ordenCorrecto,
  colors,
  t,
}: {
  isCorrect: boolean;
  explanation: string;
  /** Solo en ordenar, al fallar: el orden correcto. */
  ordenCorrecto?: string[];
  colors: ThemeColors;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const bgColor = isCorrect
    ? (colors.fill?.greenSubtle ?? '#1A3B2B')
    : (colors.fill?.redSubtle ?? '#3B1A1A');
  const iconName = isCorrect ? 'checkmark-circle' : 'bulb';
  const iconColor = isCorrect ? colors.system.green : colors.system.red;
  const label = isCorrect ? t('quiz.correct') : t('quiz.incorrectCeti');

  return (
    <Animated.View
      entering={enterSlideUp()}
      style={[feedbackSt.wrap, { backgroundColor: bgColor, borderColor: iconColor }]}
    >
      <View style={feedbackSt.titleRow}>
        <Ionicons name={iconName} size={20} color={iconColor} />
        <Text style={[feedbackSt.title, { color: iconColor }]}>{label}</Text>
      </View>
      {!isCorrect && ordenCorrecto ? (
        <View style={feedbackSt.orden}>
          <Text style={[feedbackSt.text, feedbackSt.ordenTitulo, { color: colors.text.primary }]}>
            {t('quiz.ordenCorrecto')}
          </Text>
          {ordenCorrecto.map((el, i) => (
            <Text key={i} style={[feedbackSt.text, { color: colors.text.primary }]}>
              {i + 1}. {el}
            </Text>
          ))}
        </View>
      ) : null}
      {explanation ? (
        <Text style={[feedbackSt.text, { color: colors.text.secondary }]}>{explanation}</Text>
      ) : null}
      {!isCorrect ? (
        <Text style={[feedbackSt.text, { color: colors.text.tertiary }]}>
          {t('quiz.vuelveAlFinal')}
        </Text>
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
  // Tras fallar se muestra cuál era la correcta: el error es el mejor momento para aprender.
  const correctValue =
    question.tipo === 'multiple_choice'
      ? String(question.correctIndex)
      : question.tipo === 'true_false'
        ? String(question.respuesta)
        : null;
  const optionState = (value: string): OptionState => {
    if (value !== selectedOption) {
      if (!hasSubmitted) return 'idle';
      return !isCorrect && value === correctValue ? 'reveal' : 'muted';
    }
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
          ordenCorrecto={
            question.tipo === 'ordenar'
              ? question.ordenCanonico.map((i) => question.elementos[i])
              : undefined
          }
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

// ─── Main screen ──────────────────────────────────────────────────────────────

export type ModoLeccion = 'leccion' | 'jefe' | 'primer_vuelo';

export interface ResultadoLeccion {
  total: number;
  acertadasALaPrimera: number;
  errores: number;
  /** XP de las respuestas (con combo), sin el bono de cierre. */
  xpRespuestas: number;
  perfecta: boolean;
  /** Ids de las preguntas acertadas a la primera (maestría del jefe). */
  idsAcertadas: string[];
}

/** Una respuesta tal como la dio el estudiante (lo que ve su profe en la clase). */
export interface RespuestaRegistrada {
  pregunta: string;
  tipo: QuizItem['tipo'];
  correcta: boolean;
  /** La opción elegida (texto), "verdadero"/"falso", o el orden elegido ("2-0-1"). */
  respuesta: string;
  /** Tiempo desde que vio la pregunta hasta que comprobó. */
  ms: number;
}

/** Todo lo que pasó en una lección o un intento de jefe, ganado o perdido. */
export interface RegistroLeccion {
  resultado: 'completado' | 'perdido';
  inicioAt: number;
  finAt: number;
  respuestas: RespuestaRegistrada[];
}

/** Velocidad (px/s) a partir de la cual un deslizamiento corto ya cambia de pregunta. */
const SWIPE_VELOCITY = 500;

export default function LeccionScreen({
  items,
  modo,
  titulo,
  color,
  mundo,
  nivel = 0,
  onSalir,
  onTerminar,
  onRegistro,
}: {
  items: QuizItem[];
  modo: ModoLeccion;
  titulo: string;
  color: string;
  /** Id del mundo (o 'onboarding'), solo para analítica. */
  mundo: string;
  nivel?: number;
  onSalir: () => void;
  onTerminar: (resultado: ResultadoLeccion) => void;
  /** Cada intento terminado o perdido, respuesta por respuesta (para la clase). */
  onRegistro?: (registro: RegistroLeccion) => void;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const questions = items;
  const vidasIniciales = modo === 'jefe' ? VIDAS_POR_MUNDO : SIN_LIMITE;

  // Intento: las falladas vuelven al final de la cola (R7: nada adaptativo).
  const [intentoState, setIntento] = useState<IntentoQuiz>(() =>
    nuevoIntento(questions.length, vidasIniciales)
  );
  const intento =
    intentoState.total === questions.length
      ? intentoState
      : nuevoIntento(questions.length, vidasIniciales);
  const estado = estadoIntento(intento);
  const currentIndex = intento.pos;
  const [xp, setXp] = useState(0);
  const [combo, setCombo] = useState(0);
  // Al perder la última vida se deja ver el corazón romperse y luego sale la pantalla de sin vidas.
  const [sinVidas, setSinVidas] = useState(false);
  const sinVidasTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminado = useRef(false);
  useEffect(
    () => () => {
      if (sinVidasTimer.current) clearTimeout(sinVidasTimer.current);
    },
    []
  );
  useEffect(() => {
    eventos.leccionInicio({ mundo, tipo: modo, nivel });
    // Solo al montar: un intento nuevo del jefe no es una lección nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Registro respuesta por respuesta, con el tiempo de cada pregunta.
  const inicioIntento = useRef(Date.now());
  const inicioPregunta = useRef(Date.now());
  const respuestas = useRef<RespuestaRegistrada[]>([]);
  useEffect(() => {
    inicioPregunta.current = Date.now();
  }, [intento.pos]);
  const cerrarRegistro = (resultado: RegistroLeccion['resultado']) =>
    onRegistro?.({
      resultado,
      inicioAt: inicioIntento.current,
      finAt: Date.now(),
      respuestas: respuestas.current,
    });

  // Respuesta de la pregunta actual (se reinicia en cada pregunta).
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [chosenOrder, setChosenOrder] = useState<number[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const currentQuestion = questions[preguntaActual(intento) ?? -1] ?? null;

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
    if (!hasAnswer || !currentQuestion || hasSubmitted) return;

    const correct = isAnswerCorrect(currentQuestion, {
      selectedOption,
      chosenOrder,
      hasSubmitted,
    });
    respuestas.current = [
      ...respuestas.current,
      {
        pregunta: currentQuestion.id,
        tipo: currentQuestion.tipo,
        correcta: correct,
        respuesta:
          currentQuestion.tipo === 'ordenar'
            ? chosenOrder.join('-')
            : String(selectedOption ?? '').slice(0, 80),
        ms: Math.max(0, Date.now() - inicioPregunta.current),
      },
    ];
    const nuevoCombo = correct ? combo + 1 : 0;
    setXp((x) => x + xpRespuesta(correct, combo));
    setCombo(nuevoCombo);
    eventos.respuesta({ mundo, tipo: modo, correcta: correct, combo: nuevoCombo });

    if (correct && nuevoCombo === COMBO_DESDE) {
      // Micro-celebración: el combo se enciende.
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      void Haptics.impactAsync(
        correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy
      );
    }
    const despues = registrarRespuesta(intento, correct);
    setIntento(despues);
    setHasSubmitted(true);
    if (estadoIntento(despues) === 'perdido') {
      eventos.jefePerdido({ mundo });
      cerrarRegistro('perdido');
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
      if (terminado.current) return;
      terminado.current = true;
      cerrarRegistro('completado');
      const falladas = new Set(intento.falladas);
      onTerminar({
        total: questions.length,
        acertadasALaPrimera: acertadasALaPrimera(intento),
        errores: intento.errores,
        xpRespuestas: xp,
        perfecta: intento.errores === 0,
        idsAcertadas: questions.filter((_, i) => !falladas.has(i)).map((q) => q.id),
      });
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

  /** Sin vidas: el jefe empieza otra vez desde la primera pregunta, con 3 vidas. */
  const handleRestart = () => {
    setSinVidas(false);
    respuestas.current = [];
    inicioIntento.current = Date.now();
    setIntento(nuevoIntento(questions.length, vidasIniciales));
    setXp(0);
    setCombo(0);
    setHistory([]);
    setSelectedOption(null);
    setChosenOrder([]);
    setHasSubmitted(false);
    setViewIndex(0);
    pos.set(0);
  };

  // ── Sin vidas (después de ver el corazón romperse) ────────────────────────
  if (estado === 'perdido' && sinVidas) {
    return (
      <QuizSinVidas
        worldName={titulo}
        accentColor={color}
        insetTop={insets.top}
        insetBottom={insets.bottom}
        onRetry={handleRestart}
        onBack={onSalir}
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
        titulo={titulo}
        accentColor={color}
        aciertos={intento.aciertos}
        total={questions.length}
        vidas={intento.vidas}
        xp={xp}
        combo={combo}
        onBack={onSalir}
        colors={colors}
        insetTop={insets.top}
        backLabel={t('quiz.salir')}
        livesLabel={t('quiz.livesA11y', { count: intento.vidas })}
        xpLabel={t('quiz.xpA11y', { xp, combo })}
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
            style={[styles.actionBtn, styles.reviewBtn, { borderColor: color }]}
          >
            <Text style={[styles.actionBtnText, { color }]}>{t('quiz.backToCurrent')}</Text>
            <Ionicons name="arrow-forward" size={18} color={color} />
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
                backgroundColor: hasAnswer ? color : colors.materials.highlight,
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
            style={[styles.actionBtn, { backgroundColor: color }]}
          >
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>
              {isLastQuestion ? t('quiz.terminar') : t('quiz.next')}
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
  lado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 34,
    justifyContent: 'flex-end',
  },
  xp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  xpText: {
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
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
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
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
  orden: { gap: 2 },
  ordenTitulo: { fontWeight: '700' },
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
