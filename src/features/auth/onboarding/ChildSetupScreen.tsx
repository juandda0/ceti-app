// app/(auth)/onboarding/child-setup.tsx — Child setup with smooth transitions
import { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Typography } from '@shared/constants/typography';
import { BorderRadius, Spacing } from '@shared/constants/theme';
import { useChildStore } from '@features/auth/store/useChildStore';
import CetiButton from '@shared/components/CetiButton';
import CetiCard from '@shared/components/CetiCard';
import Bounceable from '@shared/components/Bounceable';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';

const AVATARS = [
  { id: 'avatar_1', emoji: '🦁' },
  { id: 'avatar_2', emoji: '🐸' },
  { id: 'avatar_3', emoji: '🦊' },
  { id: 'avatar_4', emoji: '🐼' },
  { id: 'avatar_5', emoji: '🐱' },
  { id: 'avatar_6', emoji: '🐶' },
  { id: 'avatar_7', emoji: '🦄' },
  { id: 'avatar_8', emoji: '🐨' },
];

const AGES = [6, 7, 8, 9, 10, 11, 12];

export default function ChildSetupScreen() {
  const router = useRouter();
  const setProfile = useChildStore((s) => s.setProfile);
  const updateStreak = useChildStore((s) => s.updateStreak);
  const colors = useThemeColors();
  const mode = useThemeStore(s => s.mode);
  const styles = getStyles(colors, mode);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState(0);
  const [avatarId, setAvatarId] = useState('');

  const canAdvance = useCallback(() => {
    if (step === 0) return name.trim().length >= 2;
    if (step === 1) return age > 0;
    if (step === 2) return avatarId !== '';
    return true;
  }, [step, name, age, avatarId]);

  const handleNext = () => {
    if (!canAdvance()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < 3) {
      setStep(step + 1);
    } else {
      setProfile(name.trim(), name.trim(), age, avatarId);
      updateStreak();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(child)/world');
    }
  };

  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.progressContainer}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {step === 0 && (
          <Animated.View key="name" entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContainer}>
            <PageHeader 
              overline="Comencemos"
              title="¿Cómo te llamas?"
              subtitle="Escribe tu nombre para personalizar tu mundo"
              style={{ alignItems: 'center' }}
            />
            <TextInput
              style={[styles.input, Typography.headline]}
              placeholder="Tu nombre..."
              placeholderTextColor={colors.text.tertiary}
              value={name}
              onChangeText={setName}
              maxLength={20}
              autoFocus
            />
          </Animated.View>
        )}

        {step === 1 && (
          <Animated.View key="age" entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContainer}>
            <PageHeader 
              overline="Personalización"
              title="¿Cuántos años tienes?"
              subtitle="Esto nos ayuda a adaptar las lecciones"
              style={{ alignItems: 'center' }}
            />
            <View style={styles.ageGrid}>
              {AGES.map((a) => (
                <Bounceable key={a} onPress={() => { setAge(a); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                  <CetiCard variant="elevated" style={[styles.ageButton, age === a && styles.ageButtonActive]}>
                    <Text style={[styles.ageText, Typography.title2, age === a && styles.ageTextActive]}>{a}</Text>
                  </CetiCard>
                </Bounceable>
              ))}
            </View>
          </Animated.View>
        )}

        {step === 2 && (
          <Animated.View key="avatar" entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContainer}>
            <PageHeader 
              overline="Identidad"
              title="Elige tu avatar"
              subtitle="Este te representará en tu mundo"
              style={{ alignItems: 'center' }}
            />
            <View style={styles.avatarGrid}>
              {AVATARS.map((av) => (
                <Bounceable key={av.id} onPress={() => { setAvatarId(av.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                  <CetiCard variant="elevated" style={[styles.avatarButton, avatarId === av.id && styles.avatarButtonActive]}>
                    <Text style={styles.avatarEmojiText}>{av.emoji}</Text>
                  </CetiCard>
                </Bounceable>
              ))}
            </View>
          </Animated.View>
        )}

        {step === 3 && (
          <Animated.View key="welcome" entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContainer}>
            <PageHeader 
              overline="¡Listo!"
              title="¡Bienvenido/a!"
              subtitle="Tu mundo te espera. Aprende sobre el dinero y gana Cetis para hacerlo crecer."
              style={{ alignItems: 'center' }}
            />
            <View style={styles.finalAvatarContainer}>
               <Text style={styles.welcomeAvatarEmoji}>
                {AVATARS.find((a) => a.id === avatarId)?.emoji ?? '🦁'}
              </Text>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <CetiButton 
          label={step === 3 ? 'Comenzar' : 'Siguiente'} 
          onPress={handleNext} 
          disabled={!canAdvance()}
          variant="primary"
          size="large"
          style={{ width: '100%' }}
        />
      </View>
    </ScreenWrapper>
  );
}

const getStyles = (colors: any, mode: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.base, paddingTop: 80 },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.separator.transparent },
  progressDotActive: { backgroundColor: colors.brand.primary, width: 24 },
  content: { flexGrow: 1, paddingHorizontal: Spacing.base },
  stepContainer: { alignItems: 'center', paddingTop: 20 },
  input: { 
    width: '100%', 
    backgroundColor: colors.separator.transparent, 
    borderRadius: BorderRadius.xl, 
    padding: Spacing.lg, 
    color: colors.text.primary, 
    textAlign: 'center', 
    borderWidth: 1, 
    borderColor: colors.materials.border 
  },
  ageGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  ageButton: { width: 70, height: 70, justifyContent: 'center', alignItems: 'center', padding: 0, backgroundColor: colors.materials.base },
  ageButtonActive: { borderColor: colors.brand.primary, borderWidth: 2 },
  ageText: { color: colors.text.secondary },
  ageTextActive: { color: colors.brand.primary },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  avatarButton: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', padding: 0, backgroundColor: colors.materials.base },
  avatarButtonActive: { borderColor: colors.brand.primary, borderWidth: 2 },
  avatarEmojiText: { fontSize: 40 },
  finalAvatarContainer: { 
    width: 120, height: 120, 
    borderRadius: 60, 
    backgroundColor: colors.separator.transparent, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderColor: colors.materials.border
  },
  welcomeAvatarEmoji: { fontSize: 72 },
  footer: { paddingHorizontal: Spacing.base, paddingBottom: 50 },
});
