import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { BorderRadius, Spacing } from '@shared/constants/theme';

type CardVariant = 'elevated' | 'grouped' | 'hero' | 'regular';

interface CetiCardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
}

export default function CetiCard({ 
  children, 
  variant = 'regular', 
  style 
}: CetiCardProps) {
  const isHero = variant === 'hero';
  const isElevated = variant === 'elevated';
  
  return (
    <View style={[styles.shadowContainer, style]}>
      {/* 1. Contenedor de Sombra / Elevación */}
      <View style={styles.glassContainer}>
        {/* 2. Contenedor de Recorte y Blur (Efecto igual al Navbar) */}
        <BlurView
          intensity={Platform.OS === 'android' ? 60 : isHero ? 80 : 65}
          tint="dark"
          {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'none' } : {})}
          style={styles.blurWrapper}
        >
          <View style={[
            styles.content,
            isHero && styles.heroPadding,
          ]}>
            {children}
          </View>
          
          {/* 3. Reflejo superior sutil (Igual al Navbar) */}
          <View style={styles.innerStroke} pointerEvents="none" />
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowContainer: {
    borderRadius: BorderRadius.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    backgroundColor: 'transparent',
    alignSelf: 'stretch',
  },
  glassContainer: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden', 
    backgroundColor: Platform.select({
      android: 'rgba(20, 20, 24, 0.9)', // Mismo fondo que el Navbar
      default: 'rgba(0, 0, 0, 0.25)',
    }),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)', // Mismo borde que el Navbar
    flexDirection: 'column',
    alignSelf: 'stretch',
    ...Platform.select({
      android: { elevation: 4 }
    })
  },
  blurWrapper: {
    alignSelf: 'stretch',
  },
  content: {
    padding: Spacing.base,
    zIndex: 1,
    alignSelf: 'stretch',
  },
  heroPadding: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing['2xl'],
  },
  innerStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)', // Mismo reflejo superior que el Navbar
    backgroundColor: 'transparent',
  },
});