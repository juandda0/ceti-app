// WorldRocketLoader.tsx — Pantalla de transición de viaje entre mundos
import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';

const rocketAnimation = require('../../../../assets/lottie/rocket-loading.json');

const PHRASES = [
  'Preparando motores...',
  'Surcando el cosmos...',
  'Cruzando nebulosas...',
  'Aterrizando en tu nuevo mundo...',
];
const TRAVEL_MS = 3000;

interface WorldRocketLoaderProps {
  visible: boolean;
  onArrive: () => void;
}

export default function WorldRocketLoader({ visible, onArrive }: WorldRocketLoaderProps) {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!visible) {
      setPhraseIdx(0);
      return;
    }
    let idx = 0;
    const phraseInterval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        idx = Math.min(idx + 1, PHRASES.length - 1);
        setPhraseIdx(idx);
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
    }, TRAVEL_MS / PHRASES.length);

    timerRef.current = setTimeout(onArrive, TRAVEL_MS);

    return () => {
      clearInterval(phraseInterval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" statusBarTranslucent>
      <View style={styles.root}>
        <LottieView source={rocketAnimation} autoPlay loop style={styles.lottie} speed={1.2} />
        <View style={styles.phraseRow}>
          <Ionicons name="rocket-outline" size={18} color="rgba(255,255,255,0.7)" />
          <Animated.Text style={[styles.phrase, { opacity: fadeAnim }]}>
            {PHRASES[phraseIdx]}
          </Animated.Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#04071A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  lottie: {
    width: 260,
    height: 260,
  },
  phraseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phrase: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
