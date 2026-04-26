import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Modal, TouchableOpacity, Dimensions, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut, useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import { useChildStore } from '@features/auth/store/useChildStore';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');
const SAFE_TOP = Platform.OS === 'ios' ? 50 : 30;

const ION_ASSETS = {
  feliz: require('../../../../assets/ion/ion feliz.png'),
  serio: require('../../../../assets/ion/ion serio-cara de poker.png'),
  sorprendido: require('../../../../assets/ion/ion sorprendido.png'),
};

type Expression = keyof typeof ION_ASSETS;

interface TutorialStep {
  title: string;
  text: string;
  expression: Expression;
  highlight?: { x: number; y: number; w: number; h: number; r: number };
  ionPos: { top?: number; bottom?: number; left?: number; right?: number };
  dialogPos: 'top' | 'bottom';
}

const STEPS: TutorialStep[] = [
  {
    title: "¡HOLA EXPLORADOR!",
    text: "¡Bienvenido a Ceti! Soy Ion, tu asistente de bolsillo y guía en este mundo asteroide.",
    expression: "feliz",
    ionPos: { top: height * 0.15 },
    dialogPos: 'bottom',
  },
  {
    title: "TU PROGRESO",
    text: "Aquí arriba verás tu Nivel y XP. ¡Completa lecciones para ver cómo sube esa barra!",
    expression: "sorprendido",
    highlight: { x: 12, y: SAFE_TOP - 4, w: width * 0.58, h: 72, r: 36 },
    ionPos: { top: SAFE_TOP + 80 },
    dialogPos: 'bottom',
  },
  {
    title: "TUS RECURSOS",
    text: "Aquí están tus Cetis y tu Racha. ¡No dejes que el fuego se apague!",
    expression: "feliz",
    highlight: { x: width * 0.68, y: SAFE_TOP - 4, w: width * 0.3, h: 88, r: 25 },
    ionPos: { top: SAFE_TOP + 100 },
    dialogPos: 'bottom',
  },
  {
    title: "¡A APRENDER!",
    text: "Este es el botón más importante. Toca aquí para empezar tus misiones de aprendizaje.",
    expression: "sorprendido",
    highlight: { x: width * 0.5 - 130, y: height - 192, w: 260, h: 72, r: 36 },
    ionPos: { bottom: 210 },
    dialogPos: 'top',
  },
  {
    title: "SECCIÓN DE APRENDER",
    text: "Aquí encontrarás todas tus lecciones organizadas por mundos. ¡Vamos a echar un vistazo!",
    expression: "feliz",
    highlight: { x: width * 0.25, y: height - 85, w: width * 0.25, h: 85, r: 0 },
    ionPos: { bottom: 120 },
    dialogPos: 'top',
  },
  {
    title: "¡TODO LISTO!",
    text: "¡La aventura comienza! Te llevaré a tu primera lección para que veas cómo funciona.",
    expression: "feliz",
    ionPos: { top: height * 0.25 },
    dialogPos: 'bottom',
  },
];

export default function TutorialGuide() {
  const [currentStep, setCurrentStep] = useState(0);
  const { hasCompletedTutorial, completeTutorial, nickname } = useChildStore();
  const colors = useThemeColors();
  const router = useRouter();
  
  const spotlightX = useSharedValue(width / 2);
  const spotlightY = useSharedValue(height / 2);
  const spotlightW = useSharedValue(0);
  const spotlightH = useSharedValue(0);
  const spotlightR = useSharedValue(0);

  useEffect(() => {
    const step = STEPS[currentStep];
    if (step.highlight) {
      spotlightX.value = withSpring(step.highlight.x);
      spotlightY.value = withSpring(step.highlight.y);
      spotlightW.value = withSpring(step.highlight.w);
      spotlightH.value = withSpring(step.highlight.h);
      spotlightR.value = withSpring(step.highlight.r);
    } else {
      spotlightW.value = withTiming(0);
      spotlightH.value = withTiming(0);
    }
  }, [currentStep]);


  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTutorial();
      router.push('/(child)/learn');
    }
  };

  const step = STEPS[currentStep];

  // Spotlight logic using huge borders to create a hole
  const holeStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: spotlightX.value - 2000,
    top: spotlightY.value - 2000,
    width: spotlightW.value + 4000,
    height: spotlightH.value + 4000,
    borderWidth: 2000,
    borderColor: 'rgba(0,0,0,0.75)',
    borderRadius: spotlightR.value + 2000,
  }));

  const highlightBorder = useAnimatedStyle(() => ({
    position: 'absolute',
    left: spotlightX.value,
    top: spotlightY.value,
    width: spotlightW.value,
    height: spotlightH.value,
    borderRadius: spotlightR.value,
    borderWidth: 3,
    borderColor: colors.brand.primary,
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
  }));

  return (
    <Modal transparent visible={true} animationType="fade">
      <View style={styles.overlay}>
        {/* The "Hole" in the background */}
        <Animated.View style={holeStyle} />
        
        {/* Bright Border around the highlighted item */}
        {step.highlight && <Animated.View style={highlightBorder} />}

        <View style={styles.container} pointerEvents="box-none">
          
          <Animated.View 
            key={`step-${currentStep}`}
            entering={FadeIn.duration(400)}
            style={[styles.ionWrapper, step.ionPos]}
            pointerEvents="box-none"
          >
            {/* Dialog Box (Top or Bottom of Ion) */}
            {step.dialogPos === 'top' && (
              <View style={[styles.dialogBox, styles.dialogTop, { backgroundColor: colors.background.secondary, borderColor: colors.brand.primary }]}>
                <DialogContent step={step} currentStep={currentStep} nickname={nickname} onNext={handleNext} colors={colors} />
              </View>
            )}

            <Image 
              source={ION_ASSETS[step.expression]} 
              style={styles.ionImage} 
              resizeMode="contain" 
            />

            {step.dialogPos === 'bottom' && (
              <View style={[styles.dialogBox, styles.dialogBottom, { backgroundColor: colors.background.secondary, borderColor: colors.brand.primary }]}>
                <DialogContent step={step} currentStep={currentStep} nickname={nickname} onNext={handleNext} colors={colors} />
              </View>
            )}
          </Animated.View>

        </View>
      </View>
    </Modal>
  );
}

function DialogContent({ step, currentStep, nickname, onNext, colors }: any) {
  return (
    <>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.brand.primary }]}>{step.title}</Text>
        <Text style={[styles.stepCount, { color: colors.text.tertiary }]}>{currentStep + 1}/{STEPS.length}</Text>
      </View>
      
      <Text style={[styles.message, { color: colors.text.primary }]}>
        {currentStep === 0 ? `¡Hola ${nickname}! ` : ''}{step.text}
      </Text>

      <TouchableOpacity 
        onPress={onNext} 
        activeOpacity={0.8}
        style={[styles.button, { backgroundColor: colors.brand.primary }]}
      >
        <Text style={[styles.buttonText, { color: colors.text.onBrand }]}>
          {currentStep === STEPS.length - 1 ? '¡LISTO!' : 'ENTENDIDO'}
        </Text>
        <Ionicons name="arrow-forward" size={18} color={colors.text.onBrand} />
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    overflow: 'hidden',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  ionWrapper: {
    position: 'absolute',
    width: width * 0.65,
    height: width * 0.65,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  ionImage: {
    width: '100%',
    height: '100%',
    zIndex: 5,
  },
  dialogBox: {
    width: width * 0.85,
    padding: 20,
    borderRadius: 28,
    borderWidth: 2,
    gap: 10,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    position: 'absolute',
    alignSelf: 'center',
  },
  dialogTop: {
    bottom: '90%',
  },
  dialogBottom: {
    top: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    ...Typography.title3,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  stepCount: {
    ...Typography.caption2,
    fontWeight: '800',
  },
  message: {
    ...Typography.headline,
    fontSize: 15,
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
  },
  buttonText: {
    ...Typography.subheadline,
    fontSize: 14,
    fontWeight: '900',
  },
});
