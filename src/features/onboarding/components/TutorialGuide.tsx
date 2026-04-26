import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Modal, TouchableOpacity, Dimensions, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp, SlideInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import { useChildStore } from '@features/auth/store/useChildStore';

const { width, height } = Dimensions.get('window');

const ION_ASSETS = {
  feliz: require('../../../../assets/ion/ion feliz.png'),
  serio: require('../../../../assets/ion/ion serio-cara de poker.png'),
  sorprendido: require('../../../../assets/ion/ion sorprendido.png'),
};

type Expression = keyof typeof ION_ASSETS;

interface TutorialStep {
  text: string;
  expression: Expression;
  title: string;
}

const STEPS: TutorialStep[] = [
  {
    title: "¡HOLA EXPLORADOR!",
    text: "¡Bienvenido a Ceti! Soy Ion, tu asistente de bolsillo y guía en este mundo asteroide.",
    expression: "feliz",
  },
  {
    title: "TU PROPIO MUNDO",
    text: "Este asteroide es tuyo. Aquí verás cómo crece tu sabiduría y tus ahorros mientras exploras.",
    expression: "feliz",
  },
  {
    title: "¿CÓMO APRENDER?",
    text: "Toca el botón 'APRENDER AHORA' o visita los edificios. Cada lección completada te da XP y Cetis.",
    expression: "sorprendido",
  },
  {
    title: "LOS CETIS",
    text: "Los Cetis son la moneda oficial de Ceti. ¡Úsalos para desbloquear logros y personalizar tu aventura!",
    expression: "feliz",
  },
  {
    title: "METAS DE AHORRO",
    text: "En la pestaña de 'Metas', puedes guardar dinero real para lo que sueñas. ¡Papá te ayudará a validarlo!",
    expression: "serio",
  },
  {
    title: "¡EMPECEMOS!",
    text: "¡La aventura financiera comienza hoy! ¿Estás listo para convertirte en un experto?",
    expression: "feliz",
  },
];

export default function TutorialGuide() {
  const [currentStep, setCurrentStep] = useState(0);
  const { hasCompletedTutorial, completeTutorial, nickname } = useChildStore();
  const colors = useThemeColors();

  if (hasCompletedTutorial) return null;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTutorial();
    }
  };

  const step = STEPS[currentStep];

  return (
    <Modal transparent visible={!hasCompletedTutorial} animationType="fade">
      <View style={styles.overlay}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        
        <Animated.View entering={FadeIn.duration(500)} style={styles.container}>
          
          {/* Ion Image */}
          <Animated.View 
            key={step.expression} 
            entering={SlideInUp.springify()} 
            style={styles.ionContainer}
          >
            <Image 
              source={ION_ASSETS[step.expression]} 
              style={styles.ionImage} 
              resizeMode="contain" 
            />
          </Animated.View>

          {/* Dialog Box */}
          <Animated.View entering={SlideInDown.springify()} style={[styles.dialogBox, { backgroundColor: colors.background.secondary, borderColor: colors.brand.primary }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.brand.primary }]}>{step.title}</Text>
              <Text style={[styles.stepCount, { color: colors.text.tertiary }]}>{currentStep + 1}/{STEPS.length}</Text>
            </View>
            
            <Text style={[styles.message, { color: colors.text.primary }]}>
              {currentStep === 0 ? `¡Hola ${nickname}! ` : ''}{step.text}
            </Text>

            <TouchableOpacity 
              onPress={handleNext} 
              activeOpacity={0.8}
              style={[styles.button, { backgroundColor: colors.brand.primary }]}
            >
              <Text style={[styles.buttonText, { color: colors.text.onBrand }]}>
                {currentStep === STEPS.length - 1 ? '¡VAMOS!' : 'CONTINUAR'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={colors.text.onBrand} />
            </TouchableOpacity>
          </Animated.View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  ionContainer: {
    width: width * 0.8,
    height: width * 0.8,
    marginBottom: -40,
    zIndex: 2,
  },
  ionImage: {
    width: '100%',
    height: '100%',
  },
  dialogBox: {
    width: '100%',
    padding: 32,
    borderRadius: 40,
    borderWidth: 2,
    gap: 16,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    ...Typography.title3,
    fontWeight: '900',
    letterSpacing: 1,
  },
  stepCount: {
    ...Typography.caption2,
    fontWeight: '800',
  },
  message: {
    ...Typography.headline,
    lineHeight: 28,
    minHeight: 80,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    gap: 12,
    marginTop: 8,
  },
  buttonText: {
    ...Typography.subheadline,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
