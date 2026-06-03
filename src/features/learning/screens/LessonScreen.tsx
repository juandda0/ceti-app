import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, TextInput } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { safeRouterBack } from '@shared/utils/safeRouterBack';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';

import {
  LESSONS,
  type GoalCreatorStep,
  type ChoosePathStep,
} from '@features/learning/data/lessons';
import { useLessonsStore } from '@features/learning/store/useLessonsStore';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useStreakCelebrationStore } from '@features/auth/store/useStreakCelebrationStore';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import CetiButton from '@shared/components/CetiButton';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import { showCetiNotice } from '@shared/store/useCetiOverlayStore';
import { logEvent } from '@shared/lib/analytics/logEvent';

const STORY_LOTTIE_MAP: Record<string, unknown> = {
  barter: require('../../../../assets/lessons/lesson1.json'),
  needs_vs_wants: require('../../../../assets/lessons/lesson2.json'),
  income: require('../../../../assets/lessons/lesson3.json'),
  smart_buy: require('../../../../assets/lessons/lesson4.json'),
  full_plan: require('../../../../assets/lessons/lesson5.json'),
};

function shuffleArray<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const StoryStepView = ({ step, colors }: { step: any; colors: any }) => (
  <Animated.View entering={motion.stepEnter} exiting={motion.stepExit} style={styles.stepContent}>
    <View style={styles.illustrationContainer}>
      {STORY_LOTTIE_MAP[step.illustration] ? (
        <LottieView
          source={STORY_LOTTIE_MAP[step.illustration] as any}
          autoPlay
          loop
          style={styles.storyLottie}
        />
      ) : (
        <Ionicons name="image-outline" size={100} color={colors.brand.primary} />
      )}
    </View>
    <Text style={[styles.stepTitle, { color: colors.text.primary }]}>{step.title}</Text>
    <Text style={[styles.stepText, { color: colors.text.secondary }]}>{step.content}</Text>
  </Animated.View>
);

const QuizStepView = ({
  step,
  onAnswer,
  colors,
}: {
  step: any;
  onAnswer: (correct: boolean, explanation: string, selectedText: string) => void;
  colors: any;
}) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);

  const optionStamp = step.options.map((o: { text: string }) => o.text).join('');
  const shuffledOptions = useMemo(
    () => shuffleArray(step.options as { text: string; correct: boolean }[]),
    [step.question, optionStamp]
  );

  const handlePress = (index: number) => {
    if (blocked) return;
    setSelected(index);
    setBlocked(true);
    const opt = shuffledOptions[index];
    if (opt.correct) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    onAnswer(opt.correct, step.explanation, opt.text);
  };

  return (
    <Animated.View entering={motion.stepEnter} exiting={motion.stepExit} style={styles.stepContent}>
      <Text style={[styles.questionText, { color: colors.text.primary }]}>{step.question}</Text>
      <View style={styles.optionsContainer}>
        {shuffledOptions.map((opt: { text: string; correct: boolean }, i: number) => {
          const isSelected = selected === i;
          const bg = isSelected
            ? opt.correct
              ? colors.system.green
              : colors.system.red
            : colors.materials.base;
          return (
            <TouchableOpacity
              key={`${opt.text}-${i}`}
              onPress={() => handlePress(i)}
              activeOpacity={0.7}
              style={[
                styles.optionBtn,
                { backgroundColor: bg, borderColor: isSelected ? bg : colors.materials.border },
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  { color: isSelected ? colors.text.inverse : colors.text.primary },
                ]}
              >
                {opt.text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
};

const ChoosePathStepView = ({
  step,
  onChoice,
  colors,
}: {
  step: ChoosePathStep;
  onChoice: (isSmartChoice: boolean, consequence: string, choiceText: string) => void;
  colors: any;
}) => {
  const [chosen, setChosen] = useState<0 | 1 | null>(null);
  const [blocked, setBlocked] = useState(false);

  const handlePress = (idx: 0 | 1) => {
    if (blocked) return;
    setChosen(idx);
    setBlocked(true);
    const opt = step.options[idx];
    if (opt.isSmartChoice) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onChoice(opt.isSmartChoice, opt.consequence, opt.text);
  };

  return (
    <Animated.View entering={motion.stepEnter} exiting={motion.stepExit} style={styles.stepContent}>
      <View
        style={[
          styles.situationBox,
          { backgroundColor: colors.background.secondary, borderColor: colors.materials.border },
        ]}
      >
        <Ionicons
          name="git-compare-outline"
          size={32}
          color={colors.brand.primary}
          style={{ marginBottom: 12 }}
        />
        <Text style={[styles.situationText, { color: colors.text.primary }]}>{step.situation}</Text>
      </View>

      <Text style={[styles.chooseLabel, { color: colors.text.tertiary }]}>Elige tu camino</Text>

      <View style={styles.choiceButtonsContainer}>
        {step.options.map((opt, idx) => {
          const isChosen = chosen === idx;
          const bg = isChosen
            ? opt.isSmartChoice
              ? colors.system.green
              : colors.system.orange
            : colors.materials.base;
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => handlePress(idx as 0 | 1)}
              activeOpacity={0.8}
              style={[
                styles.choiceBtn,
                { backgroundColor: bg, borderColor: isChosen ? bg : colors.materials.border },
              ]}
            >
              <Text
                style={[
                  styles.choiceBtnText,
                  { color: isChosen ? colors.text.inverse : colors.text.primary },
                ]}
              >
                {opt.text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
};

const InteractiveStepView = ({
  step,
  onResult,
  colors,
}: {
  step: any;
  onResult: (
    correct: boolean,
    explanation: string,
    selectedText: string,
    action: 'next' | 'stay'
  ) => void;
  colors: any;
}) => {
  const [items, setItems] = useState(step.items);

  const handleClassify = (item: any, category: string) => {
    const isCorrect = item.category === category;
    const selectedText = `${item.text} -> ${category === 'need' ? 'Necesidad' : 'Deseo'}`;
    if (!isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      onResult(
        false,
        'No era esa categoría. Mira si es algo básico o algo que puede esperar.',
        selectedText,
        'stay'
      );
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const isLastItem = items.length === 1;
    onResult(true, 'Bien clasificado. ¡Sigue así!', selectedText, isLastItem ? 'next' : 'stay');
    setItems(items.filter((i: any) => i.text !== item.text));
  };

  return (
    <Animated.View entering={motion.stepEnter} exiting={motion.stepExit} style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text.primary }]}>{step.title}</Text>
      <Text style={[styles.stepText, { color: colors.text.secondary, marginBottom: 30 }]}>
        {step.instruction}
      </Text>
      {items.length > 0 ? (
        <Animated.View layout={motion.layout} style={styles.itemToClassify}>
          <Text style={[styles.itemText, { color: colors.brand.primary }]}>{items[0].text}</Text>
          <View style={styles.classifyButtons}>
            <TouchableOpacity
              onPress={() => handleClassify(items[0], 'need')}
              style={[styles.classifyBtn, { backgroundColor: colors.fill.blueStrong }]}
            >
              <Text style={{ color: colors.system.blue, fontWeight: 'bold' }}>Necesidad</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleClassify(items[0], 'want')}
              style={[styles.classifyBtn, { backgroundColor: colors.fill.purpleStrong }]}
            >
              <Text style={{ color: colors.system.purple, fontWeight: 'bold' }}>Deseo</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : (
        <Ionicons name="checkmark-done-circle" size={80} color={colors.system.green} />
      )}
    </Animated.View>
  );
};

const SimulationStepView = ({
  step,
  onResult,
  colors,
}: {
  step: any;
  onResult: (correct: boolean, explanation: string, selectedText: string) => void;
  colors: any;
}) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  const checkAnswer = () => {
    if (parseInt(value) === step.answer) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onResult(true, `Excelente. ${step.hint}`, value || '(sin respuesta)');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      onResult(false, `Respuesta incorrecta. Pista: ${step.hint}`, value || '(sin respuesta)');
      setError(true);
      setTimeout(() => setError(false), 1000);
    }
  };

  return (
    <Animated.View entering={motion.stepEnter} exiting={motion.stepExit} style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text.primary }]}>{step.title}</Text>
      <Text style={[styles.stepText, { color: colors.text.secondary, marginBottom: 30 }]}>
        {step.instruction}
      </Text>
      <View
        style={[
          styles.inputBox,
          { borderColor: error ? colors.system.red : colors.materials.border },
        ]}
      >
        <TextInput
          style={[styles.simInput, { color: colors.text.primary }]}
          value={value}
          onChangeText={setValue}
          keyboardType="number-pad"
          placeholder="Tu respuesta..."
          placeholderTextColor={colors.text.tertiary}
        />
      </View>
      <CetiButton
        label="Validar"
        onPress={checkAnswer}
        variant="primary"
        size="medium"
        style={{ marginTop: 20 }}
      />
      <Text style={[styles.hintText, { color: colors.text.tertiary }]}>Pista: {step.hint}</Text>
    </Animated.View>
  );
};

const GoalCreatorStepView = ({ step, colors }: { step: GoalCreatorStep; colors: any }) => (
  <Animated.View entering={motion.stepEnter} exiting={motion.stepExit} style={styles.stepContent}>
    <Text style={[styles.stepTitle, { color: colors.text.primary }]}>{step.title}</Text>
    <Text style={[styles.stepText, { color: colors.text.secondary }]}>{step.instruction}</Text>
    {step.fields?.length ? (
      <Text style={[styles.hintText, { color: colors.text.tertiary, marginTop: 12 }]}>
        {step.fields.join(' · ')}
      </Text>
    ) : null}
  </Animated.View>
);

export default function LessonScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const lessonId = useMemo(() => {
    const raw = params.id;
    if (Array.isArray(raw)) return raw[0] ?? '';
    return raw ?? '';
  }, [params.id]);

  const router = useRouter();
  const colors = useThemeColors();

  const lesson = useMemo(() => LESSONS.find((l) => l.id === lessonId), [lessonId]);

  useEffect(() => {
    if (!lesson) return;
    void logEvent('lesson_started', { lesson_id: lesson.id });
  }, [lesson]);

  const { completeLesson } = useLessonsStore();
  const earnCetis = useWalletStore((s) => s.earnCetis);
  const addXP = useUserStore((s) => s.addXP);
  const incrementLessonsCompleted = useUserStore((s) => s.incrementLessonsCompleted);
  const recordStreakOnMissionComplete = useUserStore((s) => s.recordStreakOnMissionComplete);
  const registerMissionCalendarDay = useUserStore((s) => s.registerMissionCalendarDay);
  const uid = useAuthStore((s) => s.firebaseUid) ?? useUserStore.getState().id;

  const [currentStep, setCurrentStep] = useState(0);
  const [quizScores, setQuizScores] = useState<boolean[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [hasPassed, setHasPassed] = useState(true);
  const [lives, setLives] = useState(3);
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [showNotebookModal, setShowNotebookModal] = useState(false);
  const [answerWasCorrect, setAnswerWasCorrect] = useState(true);
  const [answerExplanation, setAnswerExplanation] = useState('');
  const [answerSelectedText, setAnswerSelectedText] = useState('');
  const [pendingAction, setPendingAction] = useState<'next' | 'stay'>('next');

  if (!lessonId || !lesson) {
    return <Redirect href="/(app)/saga" />;
  }

  const progress = isFinished ? 100 : ((currentStep + 1) / lesson.steps.length) * 100;
  const currentStepData = lesson.steps[currentStep];

  const handleNext = () => {
    if (currentStep < lesson.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      finishLesson();
    }
  };

  const openAnswerFeedback = (
    correct: boolean,
    explanation: string,
    selectedText: string,
    action: 'next' | 'stay'
  ) => {
    setAnswerWasCorrect(correct);
    setAnswerExplanation(explanation);
    setAnswerSelectedText(selectedText);
    setPendingAction(action);
    setShowAnswerModal(true);
  };

  const consumeLifeIfNeeded = (correct: boolean): boolean => {
    if (correct) return true;
    const nextLives = Math.max(0, lives - 1);
    setLives(nextLives);
    if (nextLives === 0) {
      showCetiNotice({
        variant: 'error',
        title: 'Perdiste la lección',
        message: 'Te quedaste sin vidas. Vuelve al mapa y cuando quieras la intentas de nuevo.',
        onDismiss: () => {
          router.replace('/(app)/saga');
        },
      });
      return false;
    }
    return true;
  };

  const onQuizAnswer = (correct: boolean, explanation: string, selectedText: string) => {
    openAnswerFeedback(correct, explanation, selectedText, 'next');
    setQuizScores((prev) => [...prev, correct]);
  };

  const onChoicePathAnswer = (isSmartChoice: boolean, consequence: string, choiceText: string) => {
    openAnswerFeedback(isSmartChoice, consequence, choiceText, 'next');
    setQuizScores((prev) => [...prev, isSmartChoice]);
    if (isSmartChoice) useUserStore.getState().incrementSavingsDecisions();
  };

  const onSimulationResult = (correct: boolean, explanation: string, selectedText: string) => {
    openAnswerFeedback(correct, explanation, selectedText, correct ? 'next' : 'stay');
  };

  const onInteractiveResult = (
    correct: boolean,
    explanation: string,
    selectedText: string,
    action: 'next' | 'stay'
  ) => {
    openAnswerFeedback(correct, explanation, selectedText, action);
  };

  const onAnswerUnderstood = () => {
    setShowAnswerModal(false);
    const canContinue = consumeLifeIfNeeded(answerWasCorrect);
    if (!canContinue) return;
    if (pendingAction === 'next') handleNext();
  };

  const finishLesson = () => {
    const totalQuizzes = quizScores.length;
    const correctQuizzes = quizScores.filter((s) => s).length;
    const score = totalQuizzes > 0 ? (correctQuizzes / totalQuizzes) * 100 : 100;
    const passed = score >= 70;
    setHasPassed(passed);

    if (passed) {
      const firstCompletion = completeLesson(uid, lesson.id, score);
      void logEvent('lesson_completed', {
        lesson_id: lesson.id,
        first_completion: firstCompletion,
        score_rounded: Math.round(score),
      });
      if (firstCompletion) {
        earnCetis(lesson.cetisReward, `Lección: ${lesson.title}`, 'lesson');
        addXP(lesson.xpReward);
        incrementLessonsCompleted();
        registerMissionCalendarDay();
        const streakPayload = recordStreakOnMissionComplete();
        if (streakPayload) useStreakCelebrationStore.getState().show(streakPayload);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setIsFinished(true);
  };

  const retryLesson = () => {
    setCurrentStep(0);
    setQuizScores([]);
    setIsFinished(false);
    setHasPassed(true);
    setLives(3);
  };

  return (
    <ScreenWrapper style={[styles.container, { backgroundColor: colors.background.base }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => safeRouterBack(router, '/(app)/saga')}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={[styles.progressTrack, { backgroundColor: colors.background.tertiary }]}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: `${progress}%`, backgroundColor: colors.brand.primary },
            ]}
          />
        </View>
        <View style={styles.livesWrap}>
          <Ionicons name="heart" size={18} color={colors.system.red} />
          <Text style={[styles.livesText, { color: colors.text.primary }]}>{lives}</Text>
        </View>
        <Text style={[styles.stepCount, { color: colors.text.tertiary }]}>
          {currentStep + 1} / {lesson.steps.length}
        </Text>
      </View>

      <View style={styles.body}>
        {isFinished ? (
          <Animated.View entering={motion.enterDown(0)} style={styles.finishContent}>
            {hasPassed ? (
              <>
                <View style={styles.finishHeader}>
                  <View
                    style={[styles.successCircle, { backgroundColor: colors.fill.greenSubtle }]}
                  >
                    <Ionicons name="checkmark-circle" size={80} color={colors.system.green} />
                  </View>
                  <Text style={[styles.finishTitle, { color: colors.text.primary }]}>
                    LECCIÓN COMPLETADA
                  </Text>
                  <Text style={[styles.finishSub, { color: colors.text.tertiary }]}>
                    Has dado un gran paso
                  </Text>
                </View>
                <View style={styles.rewardCards}>
                  <Animated.View
                    entering={motion.enterDown(96)}
                    style={[
                      styles.rewardCard,
                      {
                        backgroundColor: colors.fill.brandSubtle,
                        borderColor: colors.materials.border,
                      },
                    ]}
                  >
                    <Ionicons name="sparkles" size={32} color={colors.brand.primary} />
                    <Text style={[styles.rewardValue, { color: colors.brand.primary }]}>
                      +{lesson.xpReward}
                    </Text>
                    <Text style={[styles.rewardLabel, { color: colors.brand.primary }]}>
                      PUNTOS XP
                    </Text>
                  </Animated.View>
                  <Animated.View
                    entering={motion.enterDown(152)}
                    style={[
                      styles.rewardCard,
                      {
                        backgroundColor: colors.fill.goldSubtle,
                        borderColor: colors.materials.border,
                      },
                    ]}
                  >
                    <Ionicons name="flash" size={32} color={colors.gold.primary} />
                    <Text style={[styles.rewardValue, { color: colors.gold.primary }]}>
                      +{lesson.cetisReward}
                    </Text>
                    <Text style={[styles.rewardLabel, { color: colors.gold.primary }]}>
                      CETIS GANADOS
                    </Text>
                  </Animated.View>
                </View>
                <CetiButton
                  label="CONTINUAR"
                  onPress={() => router.replace('/(app)/saga')}
                  variant="primary"
                  size="large"
                  style={{ marginTop: 20, width: '100%' }}
                />
              </>
            ) : (
              <>
                <View style={styles.finishHeader}>
                  <View style={[styles.successCircle, { backgroundColor: colors.fill.redSubtle }]}>
                    <Ionicons name="close-circle" size={80} color={colors.system.red} />
                  </View>
                  <Text style={[styles.finishTitle, { color: colors.text.primary }]}>¡CASI!</Text>
                  <Text style={[styles.finishSub, { color: colors.text.tertiary }]}>
                    Necesitas un 70% para ganar premios.
                  </Text>
                </View>
                <View style={{ width: '100%', gap: 12 }}>
                  <CetiButton
                    label="REINTENTAR"
                    onPress={retryLesson}
                    variant="primary"
                    size="large"
                    style={{ width: '100%' }}
                  />
                  <CetiButton
                    label="SALIR"
                    onPress={() => router.replace('/(app)/saga')}
                    variant="glass"
                    size="large"
                    style={{ width: '100%' }}
                  />
                </View>
              </>
            )}
          </Animated.View>
        ) : (
          <>
            {currentStepData.type === 'story' && (
              <StoryStepView key={`step-${currentStep}`} step={currentStepData} colors={colors} />
            )}
            {currentStepData.type === 'quiz' && (
              <QuizStepView
                key={`step-${currentStep}`}
                step={currentStepData}
                onAnswer={onQuizAnswer}
                colors={colors}
              />
            )}
            {currentStepData.type === 'choose_path' && (
              <ChoosePathStepView
                key={`step-${currentStep}`}
                step={currentStepData}
                onChoice={onChoicePathAnswer}
                colors={colors}
              />
            )}
            {currentStepData.type === 'interactive' && (
              <InteractiveStepView
                key={`step-${currentStep}`}
                step={currentStepData}
                onResult={onInteractiveResult}
                colors={colors}
              />
            )}
            {currentStepData.type === 'simulation' && (
              <SimulationStepView
                key={`step-${currentStep}`}
                step={currentStepData}
                onResult={onSimulationResult}
                colors={colors}
              />
            )}
            {currentStepData.type === 'goal_creator' && (
              <GoalCreatorStepView
                key={`step-${currentStep}`}
                step={currentStepData}
                colors={colors}
              />
            )}

            {currentStepData.type !== 'quiz' &&
              currentStepData.type !== 'simulation' &&
              currentStepData.type !== 'interactive' &&
              currentStepData.type !== 'choose_path' && (
                <View style={styles.footer}>
                  <CetiButton
                    label={currentStep === lesson.steps.length - 1 ? 'Finalizar' : 'Continuar'}
                    onPress={handleNext}
                    variant="primary"
                    size="large"
                  />
                </View>
              )}
          </>
        )}
      </View>

      <CetiBottomSheet
        visible={showAnswerModal}
        onClose={() => setShowAnswerModal(false)}
        title={answerWasCorrect ? '¡Bien hecho!' : '¡Sigue intentando!'}
        subtitle={answerWasCorrect ? 'Decisión acertada' : 'Había una mejor opción'}
        closeOnBackdropPress={false}
      >
        <View style={styles.answerSheet}>
          <Text style={[styles.answerSelectedText, { color: colors.text.primary }]}>
            {answerSelectedText}
          </Text>
          <View style={{ width: '100%', gap: 10 }}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  borderColor: answerWasCorrect ? colors.system.green : colors.system.red,
                  backgroundColor: colors.materials.highlight,
                },
              ]}
              onPress={() => {
                setShowAnswerModal(false);
                setShowNotebookModal(true);
              }}
            >
              <Text
                style={[
                  styles.actionBtnText,
                  { color: answerWasCorrect ? colors.system.green : colors.system.red },
                ]}
              >
                {answerWasCorrect ? 'VER EXPLICACIÓN' : 'ENTENDER MI ERROR'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  borderColor: answerWasCorrect ? colors.system.green : colors.system.red,
                  backgroundColor: answerWasCorrect ? colors.system.green : colors.system.red,
                },
              ]}
              onPress={onAnswerUnderstood}
            >
              <Text style={[styles.actionBtnText, { color: '#000000' }]}>SIGUIENTE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CetiBottomSheet>

      <CetiBottomSheet
        visible={showNotebookModal}
        onClose={() => {
          setShowNotebookModal(false);
          onAnswerUnderstood();
        }}
        contentOnly
        closeOnBackdropPress={false}
      >
        <View style={[styles.notebookSheet, { backgroundColor: colors.materials.highlight }]}>
          <View style={styles.notebookSpiral}>
            {[...Array(9)].map((_, i) => (
              <View
                key={i}
                style={[styles.spiralHole, { backgroundColor: colors.materials.border }]}
              />
            ))}
          </View>
          <View style={[styles.notebookPaper, { backgroundColor: colors.background.secondary }]}>
            <Text style={[styles.notebookTitle, { color: colors.text.primary }]}>
              {answerWasCorrect ? 'Explicación' : '¿Por qué esa era la mejor opción?'}
            </Text>
            <Text style={[styles.notebookBody, { color: colors.text.secondary }]}>
              {answerExplanation}
            </Text>
            <View style={styles.paperLines}>
              {[...Array(7)].map((_, i) => (
                <View
                  key={i}
                  style={[styles.paperLine, { backgroundColor: colors.separator.transparent }]}
                />
              ))}
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                marginTop: 14,
                borderColor: answerWasCorrect ? colors.system.green : colors.system.red,
                backgroundColor: answerWasCorrect ? colors.system.green : colors.system.red,
              },
            ]}
            onPress={() => {
              setShowNotebookModal(false);
              onAnswerUnderstood();
            }}
          >
            <Text style={[styles.actionBtnText, { color: '#000000' }]}>SIGUIENTE</Text>
          </TouchableOpacity>
        </View>
      </CetiBottomSheet>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60, gap: 15 },
  closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  stepCount: { ...Typography.caption2, width: 45, textAlign: 'right' },
  livesWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  livesText: { ...Typography.headline, fontWeight: '800', minWidth: 12, textAlign: 'center' },
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  stepContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  illustrationContainer: { marginBottom: 32, alignItems: 'center', justifyContent: 'center' },
  storyLottie: { width: 260, height: 260 },
  stepTitle: {
    ...Typography.title2,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 24,
  },
  stepText: { ...Typography.headline, textAlign: 'center', lineHeight: 28, paddingHorizontal: 10 },
  questionText: {
    ...Typography.title3,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 32,
    fontSize: 20,
  },
  optionsContainer: { width: '100%', gap: 12 },
  optionBtn: {
    width: '100%',
    minHeight: 64,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { ...Typography.headline, fontWeight: '700', fontSize: 17 },
  situationBox: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  situationText: { ...Typography.title3, fontWeight: '700', textAlign: 'center', lineHeight: 26 },
  chooseLabel: { ...Typography.caption1, fontWeight: '600', marginBottom: 16, letterSpacing: 0.5 },
  choiceButtonsContainer: { width: '100%', gap: 12 },
  choiceBtn: {
    width: '100%',
    minHeight: 72,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceBtnText: { ...Typography.headline, fontWeight: '700', fontSize: 16, textAlign: 'center' },
  footer: { paddingVertical: 40, width: '100%' },
  finishContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    paddingVertical: 40,
  },
  finishHeader: { alignItems: 'center', gap: 12 },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  finishTitle: { ...Typography.title1, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  finishSub: { ...Typography.headline, textAlign: 'center' },
  rewardCards: { flexDirection: 'row', gap: 16, width: '100%' },
  rewardCard: {
    flex: 1,
    padding: 24,
    borderRadius: 32,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  rewardValue: { ...Typography.largeTitle, fontWeight: '900', fontSize: 32 },
  rewardLabel: { ...Typography.caption1, fontWeight: '800', letterSpacing: 1 },
  itemToClassify: { width: '100%', alignItems: 'center', gap: 20 },
  itemText: { ...Typography.title1, fontWeight: '900' },
  classifyButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  classifyBtn: { flex: 1, padding: 20, borderRadius: 16, alignItems: 'center' },
  inputBox: { width: '100%', padding: 20, borderRadius: 20, borderWidth: 2 },
  simInput: { ...Typography.title2, textAlign: 'center', fontWeight: '800' },
  hintText: { ...Typography.caption2, marginTop: 12, fontStyle: 'italic' },
  answerSheet: {
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 4,
    alignItems: 'stretch',
    gap: 0,
  },
  answerSelectedText: {
    ...Typography.body,
    textAlign: 'left',
    width: '100%',
    fontWeight: '400',
    marginBottom: 14,
  },
  actionBtn: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionBtnText: { ...Typography.headline, fontWeight: '700', textAlign: 'center' },
  notebookSheet: { width: '100%', alignSelf: 'stretch', padding: 14, alignItems: 'stretch' },
  notebookSpiral: {
    position: 'absolute',
    left: 10,
    top: 18,
    bottom: 18,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spiralHole: { width: 8, height: 8, borderRadius: 4 },
  notebookPaper: {
    width: '100%',
    minHeight: 260,
    paddingVertical: 14,
    paddingHorizontal: 18,
    paddingLeft: 26,
  },
  notebookTitle: { ...Typography.headline, fontWeight: '900', marginBottom: 10 },
  notebookBody: { ...Typography.body, lineHeight: 22, marginBottom: 10 },
  paperLines: { gap: 16 },
  paperLine: { height: 1 },
});
