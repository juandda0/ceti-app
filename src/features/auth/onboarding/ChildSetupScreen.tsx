// app/(auth)/onboarding/child-setup.tsx — Child setup with smooth transitions
import { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Typography } from '@shared/constants/typography';
import { BorderRadius, Spacing } from '@shared/constants/theme';
import { useChildStore } from '@features/auth/store/useChildStore';
import CetiButton from '@shared/components/CetiButton';
import Bounceable from '@shared/components/Bounceable';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';

import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useChildrenRegistryStore } from '@features/auth/store/useChildrenRegistryStore';
import { logEvent } from '@shared/lib/analytics/logEvent';
import { getFirebaseClients, isFirebaseConfigured } from '@shared/lib/firebase/app';
import { userRepository } from '@features/auth/data/userRepository';

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

const MIN_AGE = 1;
const MAX_AGE = 100;

function parseAge(text: string): number | null {
  const t = text.trim();
  if (t === '' || !/^\d+$/.test(t)) return null;
  const n = parseInt(t, 10);
  if (!Number.isFinite(n) || n < MIN_AGE || n > MAX_AGE) return null;
  return n;
}

export default function ChildSetupScreen() {
  const router = useRouter();
  const setProfile = useChildStore((s) => s.setProfile);
  const commitActiveChildIfOnboarded = useChildrenRegistryStore(
    (s) => s.commitActiveChildIfOnboarded
  );
  const colors = useThemeColors();
  const mode = useThemeStore((s) => s.mode);
  const styles = getStyles(colors, mode);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [ageText, setAgeText] = useState('');
  const [avatarId, setAvatarId] = useState('');

  const canAdvance = useCallback(() => {
    if (step === 0) return name.trim().length >= 2;
    if (step === 1) return parseAge(ageText) !== null;
    if (step === 2) return avatarId !== '';
    return true;
  }, [step, name, ageText, avatarId]);

  const handleNext = () => {
    if (!canAdvance()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < 3) {
      setStep(step + 1);
    } else {
      const age = parseAge(ageText) ?? 0;
      const emoji = AVATARS.find((a) => a.id === avatarId)?.emoji ?? '🦁';
      const nickname = name.trim();
      if (isFirebaseConfigured()) {
        const u = getFirebaseClients()?.auth.currentUser;
        if (!u) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
        commitActiveChildIfOnboarded();
        void userRepository
          .upsertChildDraftProfile(u.uid, {
            displayName: nickname,
            email: u.email ?? null,
            photoURL: u.photoURL ?? null,
            provider: u.providerData?.some((p) => p.providerId?.includes('google'))
              ? 'google'
              : u.providerData?.some((p) => p.providerId?.includes('apple'))
                ? 'apple'
                : 'unknown',
            childProfile: {
              nickname,
              fullName: nickname,
              age,
              avatarId,
              avatarEmoji: emoji,
              birthYear: undefined,
              consentParent: true,
            },
          })
          .then(() => {
            setProfile(nickname, nickname, age, avatarId, emoji);
            useChildStore.getState().loadProfile({ id: u.uid });
            void logEvent('child_added', { age_bracket: age >= 13 ? '13plus' : 'under13' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace('/(auth)/onboarding/child-link');
          });
      } else {
        commitActiveChildIfOnboarded();
        setProfile(nickname, nickname, age, avatarId, emoji);
        void logEvent('child_added', { age_bracket: age >= 13 ? '13plus' : 'under13' });
        useAuthStore.getState().loginAsChild();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(child)/world');
      }
    }
  };

  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.progressContainer}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 0 && (
          <Animated.View
            key="name"
            entering={motion.stepEnter}
            exiting={motion.stepExit}
            style={styles.stepContainer}
          >
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
          <Animated.View
            key="age"
            entering={motion.stepEnter}
            exiting={motion.stepExit}
            style={styles.stepContainer}
          >
            <PageHeader
              overline="Personalización"
              title="¿Cuántos años tienes?"
              subtitle="Escribe tu edad con números"
              style={{ alignItems: 'center' }}
            />
            <TextInput
              style={[styles.input, Typography.headline]}
              placeholder="Ej. 10"
              placeholderTextColor={colors.text.tertiary}
              value={ageText}
              onChangeText={(t) => setAgeText(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={3}
              autoFocus
            />
          </Animated.View>
        )}

        {step === 2 && (
          <Animated.View
            key="avatar"
            entering={motion.stepEnter}
            exiting={motion.stepExit}
            style={styles.stepContainer}
          >
            <PageHeader
              overline="Identidad"
              title="Elige tu avatar"
              subtitle="Este te representará en tu mundo"
              style={{ alignItems: 'center' }}
            />
            <View style={styles.avatarGrid}>
              {AVATARS.map((av) => (
                <Bounceable
                  key={av.id}
                  onPress={() => {
                    setAvatarId(av.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[styles.avatarButton, avatarId === av.id && styles.avatarButtonActive]}
                >
                  <Text style={styles.avatarEmojiText}>{av.emoji}</Text>
                </Bounceable>
              ))}
            </View>
          </Animated.View>
        )}

        {step === 3 && (
          <Animated.View
            key="welcome"
            entering={motion.stepEnter}
            exiting={motion.stepExit}
            style={styles.stepContainer}
          >
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

const getStyles = (colors: any, mode: string) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.base, paddingTop: 80 },
    progressContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
    progressDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.materials.highlight,
    },
    progressDotActive: { backgroundColor: colors.brand.primary, width: 24 },
    content: { flexGrow: 1, paddingHorizontal: Spacing.base },
    stepContainer: { alignItems: 'center', paddingTop: 20 },
    input: {
      width: '100%',
      backgroundColor: colors.materials.highlight,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      color: colors.text.primary,
      textAlign: 'center',
      borderWidth: 1,
      borderColor: colors.materials.border,
    },
    ageHint: {
      ...Typography.caption1,
      marginTop: Spacing.sm,
      textAlign: 'center',
    },
    avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
    avatarButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.materials.base,
      borderWidth: 2,
      borderColor: colors.materials.border,
    },
    avatarButtonActive: {
      borderColor: colors.brand.primary,
      backgroundColor: colors.fill.brandSubtle,
    },
    avatarEmojiText: { fontSize: 40 },
    finalAvatarContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.materials.highlight,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: Spacing.xl,
      borderWidth: 1,
      borderColor: colors.materials.border,
    },
    welcomeAvatarEmoji: { fontSize: 72 },
    footer: { paddingHorizontal: Spacing.base, paddingBottom: 50 },
  });
