// components/world/LevelUpModal.tsx — Level up celebration Spatial UI (Android Compatible)
import React from 'react';
import { View, Text, StyleSheet, Modal, Platform } from 'react-native';
import Animated, { BounceIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Typography } from '@shared/constants/typography';
import { Spacing, Shadows } from '@shared/constants/theme';
import CetiButton from '@shared/components/CetiButton';
import CetiCard from '@shared/components/CetiCard';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';

interface LevelUpModalProps {
  level: number;
  isVisible: boolean;
  onClose: () => void;
}

export default function LevelUpModal({ level, isVisible, onClose }: LevelUpModalProps) {
  const colors = useThemeColors();
  const mode = useThemeStore(s => s.mode);
  
  if (!isVisible) return null;

  return (
    <Modal transparent visible={isVisible} animationType="fade">
      <BlurView 
        intensity={Platform.OS === 'android' ? 100 : 90} 
        tint={mode === 'light' ? 'light' : 'dark'} 
        {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'none' } : {})}
        style={[styles.overlay, { backgroundColor: mode === 'light' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)' }]}
      >
        <ConfettiCannon count={250} origin={{ x: -10, y: 0 }} fallSpeed={2500} />
        
        <Animated.View entering={BounceIn.springify()} style={styles.container}>
          <CetiCard variant="elevated" style={[styles.modalContent, { backgroundColor: colors.materials.base, borderColor: colors.materials.border }]}>
            <Ionicons name="sparkles-outline" size={64} color={colors.gold.primary} style={{ marginBottom: Spacing.md }} />
            <Text style={[styles.congrats, Typography.title2, { color: colors.text.primary }]}>¡Nuevo Nivel!</Text>
            
            <View style={[styles.levelBadge, { backgroundColor: colors.gold.primary }, Shadows.gold]}>
              <Text style={[styles.levelNumber, Typography.displayNumberMedium, { color: colors.text.onBrand }]}>{level}</Text>
            </View>
            
            <Text style={[styles.title, Typography.subheadline, { color: colors.text.secondary }]}>Tu rango actual:</Text>
            <Text style={[styles.rank, Typography.title3, { color: colors.gold.primary }]}>Experto Financiero</Text>
            
            <Text style={[styles.description, Typography.body, { color: colors.text.secondary }]}>
              Has demostrado ser un gran administrador de tus Cetis. ¡Sigue así para desbloquear más construcciones!
            </Text>
            
            <CetiButton 
              label="Continuar" 
              onPress={onClose} 
              variant="primary" 
              size="large"
              style={{ width: '100%' }}
            />
          </CetiCard>
        </Animated.View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: Spacing.xl,
  },
  container: { width: '100%', maxWidth: 340 },
  modalContent: { alignItems: 'center', padding: Spacing.xl, borderWidth: 1, borderRadius: 32 },
  congrats: { marginBottom: Spacing.lg },
  levelBadge: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg },
  levelNumber: { },
  title: { marginBottom: 4 },
  rank: { marginBottom: Spacing.md },
  description: { textAlign: 'center', marginBottom: Spacing.xl },
});
