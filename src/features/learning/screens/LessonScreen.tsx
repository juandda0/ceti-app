import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { 
  FadeInRight, 
  FadeInDown,
  FadeOutLeft, 
  Layout, 
  SlideInRight,
  SlideOutLeft 
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { LESSONS, Lesson, LessonStep } from '@features/learning/data/lessons';
import { useLessonsStore } from '@features/learning/store/useLessonsStore';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import { useChildStore } from '@features/auth/store/useChildStore';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import CetiButton from '@shared/components/CetiButton';
import LessonTutorialGuide from '@features/learning/components/LessonTutorialGuide';

// ─── Sub-componentes de Pasos ────────────────────────────────────────────────

const StoryStepView = ({ step, colors }: { step: any, colors: any }) => (
  <Animated.View entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
    <View style={styles.illustrationContainer}>
      <View style={[styles.illustrationCircle, { backgroundColor: colors.brand.primary + '15' }]}>
        <Ionicons name="image-outline" size={80} color={colors.brand.primary} />
      </View>
    </View>
    <Text style={[styles.stepTitle, { color: colors.text.primary }]}>{step.title}</Text>
    <Text style={[styles.stepText, { color: colors.text.secondary }]}>{step.content}</Text>
  </Animated.View>
);

const QuizStepView = ({ step, onAnswer, colors }: { step: any, onAnswer: (correct: boolean) => void, colors: any }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handlePress = (index: number) => {
    if (showFeedback) return;
    setSelected(index);
    setShowFeedback(true);
    const isCorrect = step.options[index].correct;
    if (isCorrect) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    
    setTimeout(() => onAnswer(isCorrect), 1500);
  };

  return (
    <Animated.View entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
      <Text style={[styles.questionText, { color: colors.text.primary }]}>{step.question}</Text>
      <View style={styles.optionsContainer}>
        {step.options.map((opt: any, i: number) => {
          const isSelected = selected === i;
          const bg = isSelected 
            ? (opt.correct ? colors.system.green : colors.system.red) 
            : colors.materials.base;
          
          return (
            <TouchableOpacity 
              key={i} 
              onPress={() => handlePress(i)}
              activeOpacity={0.7}
              style={[styles.optionBtn, { backgroundColor: bg, borderColor: isSelected ? 'transparent' : colors.materials.border }]}
            >
              <Text style={[styles.optionText, { color: isSelected ? '#FFF' : colors.text.primary }]}>{opt.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {showFeedback && (
        <Animated.View entering={FadeInRight} style={styles.feedbackBox}>
          <Text style={[styles.feedbackText, { color: colors.text.tertiary }]}>{step.explanation}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
};

const InteractiveStepView = ({ step, onComplete, colors }: { step: any, onComplete: () => void, colors: any }) => {
  const [items, setItems] = useState(step.items);
  const [classified, setClassified] = useState<{ text: string, category: string }[]>([]);

  const handleClassify = (item: any, category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems(items.filter((i: any) => i.text !== item.text));
    setClassified([...classified, { ...item, category }]);
    
    if (items.length === 1) {
      setTimeout(onComplete, 1000);
    }
  };

  return (
    <Animated.View entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text.primary }]}>{step.title}</Text>
      <Text style={[styles.stepText, { color: colors.text.secondary, marginBottom: 30 }]}>{step.instruction}</Text>
      
      {items.length > 0 ? (
        <Animated.View layout={Layout.springify()} style={styles.itemToClassify}>
          <Text style={[styles.itemText, { color: colors.brand.primary }]}>{items[0].text}</Text>
          <View style={styles.classifyButtons}>
            <TouchableOpacity onPress={() => handleClassify(items[0], 'need')} style={[styles.classifyBtn, { backgroundColor: colors.system.blue + '20' }]}>
              <Text style={{ color: colors.system.blue, fontWeight: 'bold' }}>Necesidad</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleClassify(items[0], 'want')} style={[styles.classifyBtn, { backgroundColor: colors.system.purple + '20' }]}>
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

const SimulationStepView = ({ step, onComplete, colors }: { step: any, onComplete: () => void, colors: any }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  const checkAnswer = () => {
    if (parseInt(value) === step.answer) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(true);
      setTimeout(() => setError(false), 1000);
    }
  };

  return (
    <Animated.View entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text.primary }]}>{step.title}</Text>
      <Text style={[styles.stepText, { color: colors.text.secondary, marginBottom: 30 }]}>{step.instruction}</Text>
      
      <View style={[styles.inputBox, error && { borderColor: colors.system.red }]}>
        <TextInput 
          style={[styles.simInput, { color: colors.text.primary }]}
          value={value}
          onChangeText={setValue}
          keyboardType="number-pad"
          placeholder="Tu respuesta..."
          placeholderTextColor={colors.text.tertiary}
        />
      </View>
      
      <CetiButton label="Validar" onPress={checkAnswer} variant="primary" size="medium" style={{ marginTop: 20 }} />
      <Text style={[styles.hintText, { color: colors.text.tertiary }]}>Pista: {step.hint}</Text>
    </Animated.View>
  );
};

// ─── Pantalla Principal ──────────────────────────────────────────────────────

export default function LessonScreen() {

  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colors = useThemeColors();
  
  const lesson = useMemo(() => LESSONS.find(l => l.id === id), [id]);
  const { completeLesson } = useLessonsStore();
  const earnCetis = useWalletStore(s => s.earnCetis);
  const addXP = useChildStore(s => s.addXP);
  const incrementLessonsCompleted = useChildStore(s => s.incrementLessonsCompleted);

  const [currentStep, setCurrentStep] = useState(0);
  const [quizScores, setQuizScores] = useState<boolean[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [hasPassed, setHasPassed] = useState(true);

  if (!lesson) return null;

  const progress = (currentStep / lesson.steps.length) * 100;
  const currentStepData = lesson.steps[currentStep];

  const handleNext = () => {
    if (currentStep < lesson.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      finishLesson();
    }
  };

  const onQuizAnswer = (correct: boolean) => {
    setQuizScores([...quizScores, correct]);
    handleNext();
  };

  const finishLesson = () => {
    const totalQuizzes = quizScores.length;
    const correctQuizzes = quizScores.filter(s => s).length;
    const score = totalQuizzes > 0 ? (correctQuizzes / totalQuizzes) * 100 : 100;
    
    const passed = score >= 70;
    setHasPassed(passed);
    
    if (passed) {
      completeLesson('child_1', lesson.id, score);
      earnCetis(lesson.cetisReward, `Lección: ${lesson.title}`, 'task');
      addXP(lesson.xpReward);
      incrementLessonsCompleted();
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
  };

  return (
    <ScreenWrapper style={[styles.container, { backgroundColor: colors.background.base }]}>
      {/* Header / Progreso */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.brand.primary }]} />
        </View>
        <Text style={[styles.stepCount, { color: colors.text.tertiary }]}>{currentStep + 1} / {lesson.steps.length}</Text>
      </View>

      <View style={styles.body}>
        {isFinished ? (
          <Animated.View entering={FadeInDown.springify()} style={styles.finishContent}>
            {hasPassed ? (
              <>
                <View style={styles.finishHeader}>
                  <View style={[styles.successCircle, { backgroundColor: colors.system.green + '20' }]}>
                    <Ionicons name="checkmark-circle" size={80} color={colors.system.green} />
                  </View>
                  <Text style={[styles.finishTitle, { color: colors.text.primary }]}>¡LECCIÓN COMPLETADA!</Text>
                  <Text style={[styles.finishSub, { color: colors.text.tertiary }]}>Has dado un gran paso hoy</Text>
                </View>

                <View style={styles.rewardCards}>
                  <Animated.View entering={FadeInDown.delay(300).springify()} style={[styles.rewardCard, { backgroundColor: colors.brand.primary + '15', borderColor: colors.brand.primary + '30' }]}>
                    <Ionicons name="sparkles" size={32} color={colors.brand.primary} />
                    <Text style={[styles.rewardValue, { color: colors.brand.primary }]}>+{lesson.xpReward}</Text>
                    <Text style={[styles.rewardLabel, { color: colors.brand.primary }]}>PUNTOS XP</Text>
                  </Animated.View>
                  
                  <Animated.View entering={FadeInDown.delay(500).springify()} style={[styles.rewardCard, { backgroundColor: colors.gold.primary + '15', borderColor: colors.gold.primary + '30' }]}>
                    <Ionicons name="flash" size={32} color={colors.gold.primary} />
                    <Text style={[styles.rewardValue, { color: colors.gold.primary }]}>+{lesson.cetisReward}</Text>
                    <Text style={[styles.rewardLabel, { color: colors.gold.primary }]}>CETIS GANADOS</Text>
                  </Animated.View>
                </View>

                <CetiButton 
                  label="CONTINUAR MI AVENTURA" 
                  onPress={() => router.replace('/(child)/world')} 
                  variant="primary" 
                  size="large"
                  style={{ marginTop: 20, width: '100%' }}
                />
              </>
            ) : (
              <>
                <View style={styles.finishHeader}>
                  <View style={[styles.successCircle, { backgroundColor: colors.system.red + '20' }]}>
                    <Ionicons name="close-circle" size={80} color={colors.system.red} />
                  </View>
                  <Text style={[styles.finishTitle, { color: colors.text.primary }]}>¡OH NO, CASI!</Text>
                  <Text style={[styles.finishSub, { color: colors.text.tertiary }]}>Necesitas un 70% para ganar premios. ¡Inténtalo de nuevo!</Text>
                </View>

                <View style={styles.rewardCards}>
                  <View style={[styles.rewardCard, { opacity: 0.4, borderColor: colors.materials.border }]}>
                    <Ionicons name="lock-closed" size={32} color={colors.text.tertiary} />
                    <Text style={[styles.rewardValue, { color: colors.text.tertiary }]}>0</Text>
                    <Text style={[styles.rewardLabel, { color: colors.text.tertiary }]}>PREMIOS BLOQUEADOS</Text>
                  </View>
                </View>

                <View style={{ width: '100%', gap: 12 }}>
                  <CetiButton 
                    label="REINTENTAR LECCIÓN" 
                    onPress={retryLesson} 
                    variant="primary" 
                    size="large"
                    style={{ width: '100%' }}
                  />
                  <CetiButton 
                    label="SALIR POR AHORA" 
                    onPress={() => router.replace('/(child)/world')} 
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
            {currentStepData.type === 'story' && <StoryStepView key={`step-${currentStep}`} step={currentStepData} colors={colors} />}
            {currentStepData.type === 'quiz' && <QuizStepView key={`step-${currentStep}`} step={currentStepData} onAnswer={onQuizAnswer} colors={colors} />}
            {currentStepData.type === 'interactive' && <InteractiveStepView key={`step-${currentStep}`} step={currentStepData} onComplete={handleNext} colors={colors} />}
            {currentStepData.type === 'simulation' && <SimulationStepView key={`step-${currentStep}`} step={currentStepData} onComplete={handleNext} colors={colors} />}
            
            {/* Otros tipos de pasos se pueden añadir aquí */}
            {currentStepData.type !== 'quiz' && currentStepData.type !== 'simulation' && currentStepData.type !== 'interactive' && (
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

      <LessonTutorialGuide 
        currentStepType={currentStepData?.type} 
        currentStepIndex={currentStep} 
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    paddingTop: 60,
    gap: 15 
  },
  closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  progressTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  stepCount: { ...Typography.caption2, width: 45, textAlign: 'right' },

  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  stepContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  illustrationContainer: { marginBottom: 40 },
  illustrationCircle: { width: 180, height: 180, borderRadius: 90, justifyContent: 'center', alignItems: 'center' },
  
  stepTitle: { ...Typography.title2, fontWeight: '800', textAlign: 'center', marginBottom: 16, fontSize: 24 },
  stepText: { ...Typography.headline, textAlign: 'center', lineHeight: 28, paddingHorizontal: 10 },

  questionText: { ...Typography.title3, fontWeight: '800', textAlign: 'center', marginBottom: 32, fontSize: 20 },
  optionsContainer: { width: '100%', gap: 12 },
  optionBtn: { width: '100%', minHeight: 64, padding: 20, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  optionText: { ...Typography.headline, fontWeight: '700', fontSize: 17 },
  
  feedbackBox: { marginTop: 32, padding: 20, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)' },
  feedbackText: { ...Typography.caption1, textAlign: 'center', fontStyle: 'italic' },

  footer: { paddingVertical: 40, width: '100%' },

  finishContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 32, paddingVertical: 40 },
  finishHeader: { alignItems: 'center', gap: 12 },
  successCircle: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  finishTitle: { ...Typography.title1, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  finishSub: { ...Typography.headline, textAlign: 'center', opacity: 0.8 },
  
  rewardCards: { flexDirection: 'row', gap: 16, width: '100%' },
  rewardCard: { flex: 1, padding: 24, borderRadius: 32, alignItems: 'center', gap: 8, borderWidth: 1 },
  rewardValue: { ...Typography.largeTitle, fontWeight: '900', fontSize: 32 },
  rewardLabel: { ...Typography.caption1, fontWeight: '800', letterSpacing: 1 },

  itemToClassify: { width: '100%', alignItems: 'center', gap: 20 },
  itemText: { ...Typography.title1, fontWeight: '900' },
  classifyButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  classifyBtn: { flex: 1, padding: 20, borderRadius: 16, alignItems: 'center' },

  inputBox: { width: '100%', padding: 20, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },
  simInput: { ...Typography.title2, textAlign: 'center', fontWeight: '800' },
  hintText: { ...Typography.caption2, marginTop: 12, fontStyle: 'italic' },
});
