import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Modal, TouchableOpacity, Dimensions, Platform } from 'react-native';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
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

interface LessonTutorialProps {
  currentStepType: string;
  currentStepIndex: number;
}

export default function LessonTutorialGuide({ currentStepType, currentStepIndex }: LessonTutorialProps) {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const { hasCompletedLessonTutorial, completeLessonTutorial } = useChildStore();
  const colors = useThemeColors();

  const spotlightX = useSharedValue(width / 2);
  const spotlightY = useSharedValue(height / 2);
  const spotlightW = useSharedValue(0);
  const spotlightH = useSharedValue(0);
  const spotlightR = useSharedValue(0);

  // Lógica para mostrar el tutorial por primera vez
  useEffect(() => {
    if (hasCompletedLessonTutorial) return;

    if (currentStepIndex === 0 && currentStepType === 'story') {
      setShow(true);
      setStep(1); // Bienvenida y sección de estudio
    } else if (currentStepType === 'quiz' && step < 2) {
      setShow(true);
      setStep(2); // Sección de preguntas
    }
  }, [currentStepType, currentStepIndex, hasCompletedLessonTutorial]);

  useEffect(() => {
    if (step === 1) {
      // Resaltar área de contenido de historia
      spotlightX.value = withSpring(20);
      spotlightY.value = withSpring(height * 0.2);
      spotlightW.value = withSpring(width - 40);
      spotlightH.value = withSpring(height * 0.45);
      spotlightR.value = withSpring(30);
    } else if (step === 2) {
      // Resaltar opciones de quiz
      spotlightX.value = withSpring(20);
      spotlightY.value = withSpring(height * 0.4);
      spotlightW.value = withSpring(width - 40);
      spotlightH.value = withSpring(height * 0.4);
      spotlightR.value = withSpring(30);
    } else {
      spotlightW.value = withTiming(0);
      spotlightH.value = withTiming(0);
    }
  }, [step]);

  if (!show || hasCompletedLessonTutorial) return null;

  const handleNext = () => {
    if (step === 1) {
      setShow(false); // Esperar al quiz
    } else if (step === 2) {
      setShow(false);
      completeLessonTutorial();
    }
  };

  const getIonExpression = () => {
    if (step === 1) return 'feliz';
    return 'sorprendido';
  };

  const getTitle = () => {
    if (step === 1) return "¡HORA DE APRENDER!";
    return "¡DEMUESTRA TU PODER!";
  };

  const getMessage = () => {
    if (step === 1) return "En esta primera parte, leeremos historias para aprender la teoría. ¡Presta mucha atención!";
    return "¡Llegamos al Quiz! Aquí es donde eliges la respuesta correcta para ganar tus Cetis.";
  };

  const holeStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: spotlightX.value - 2000,
    top: spotlightY.value - 2000,
    width: spotlightW.value + 4000,
    height: spotlightH.value + 4000,
    borderWidth: 2000,
    borderColor: 'rgba(0,0,0,0.8)',
    borderRadius: spotlightR.value + 2000,
  }));

  return (
    <Modal transparent visible={show} animationType="fade">
      <View style={styles.overlay}>
        <Animated.View style={holeStyle} />
        
        <View style={styles.container} pointerEvents="box-none">
          <Animated.View entering={FadeIn} style={[styles.ionWrapper, step === 1 ? { bottom: 50 } : { top: 50 }]}>
            
            {step === 2 && (
              <View style={[styles.dialogBox, styles.dialogBottom, { backgroundColor: colors.background.secondary, borderColor: colors.brand.primary }]}>
                <Text style={[styles.title, { color: colors.brand.primary }]}>{getTitle()}</Text>
                <Text style={[styles.message, { color: colors.text.primary }]}>{getMessage()}</Text>
                <TouchableOpacity onPress={handleNext} style={[styles.button, { backgroundColor: colors.brand.primary }]}>
                  <Text style={styles.buttonText}>ENTENDIDO</Text>
                </TouchableOpacity>
              </View>
            )}

            <Image source={ION_ASSETS[getIonExpression()]} style={styles.ionImage} resizeMode="contain" />

            {step === 1 && (
              <View style={[styles.dialogBox, styles.dialogTop, { backgroundColor: colors.background.secondary, borderColor: colors.brand.primary }]}>
                <Text style={[styles.title, { color: colors.brand.primary }]}>{getTitle()}</Text>
                <Text style={[styles.message, { color: colors.text.primary }]}>{getMessage()}</Text>
                <TouchableOpacity onPress={handleNext} style={[styles.button, { backgroundColor: colors.brand.primary }]}>
                  <Text style={styles.buttonText}>¡VAMOS!</Text>
                </TouchableOpacity>
              </View>
            )}

          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, overflow: 'hidden' },
  container: { flex: 1 },
  ionWrapper: { position: 'absolute', width: width * 0.7, height: width * 0.7, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  ionImage: { width: '100%', height: '100%', zIndex: 5 },
  dialogBox: { width: width * 0.85, padding: 20, borderRadius: 28, borderWidth: 2, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10, position: 'absolute' },
  dialogTop: { bottom: '90%' },
  dialogBottom: { top: '90%' },
  title: { ...Typography.title3, fontWeight: '900', fontSize: 16 },
  message: { ...Typography.headline, fontSize: 14, lineHeight: 20 },
  button: { paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  buttonText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
});
