import { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import * as Haptics from 'expo-haptics';
import { Typography } from '@shared/constants/typography';
import { BorderRadius, Spacing } from '@shared/constants/theme';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import CetiButton from '@shared/components/CetiButton';
import Bounceable from '@shared/components/Bounceable';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import { useThemeColors } from '@shared/hooks/useThemeColors';
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

const MIN_AGE = 13;
const MAX_AGE = 100;

function parseAge(text: string): number | null {
  const t = text.trim();
  if (t === '' || !/^\d+$/.test(t)) return null;
  const n = parseInt(t, 10);
  if (!Number.isFinite(n) || n < MIN_AGE || n > MAX_AGE) return null;
  return n;
}

export default function UserSetupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const setProfile = useUserStore((s) => s.setProfile);
  const colors = useThemeColors();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [ageText, setAgeText] = useState('');
  const [avatarId, setAvatarId] = useState('');
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);

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
      setError('');
      setStep(step + 1);
    } else {
      void finishSetup();
    }
  };

  const finishSetup = async () => {
    const age = parseAge(ageText) ?? 0;
    const emoji = AVATARS.find((a) => a.id === avatarId)?.emoji ?? '🦁';
    const nickname = name.trim();

    setProfile(nickname, nickname, age, avatarId, emoji);

    if (isFirebaseConfigured()) {
      const u = getFirebaseClients()?.auth.currentUser;
      if (!u) {
        setError(t('onboarding.sessionExpired'));
        router.replace('/(auth)/welcome');
        return;
      }
      setFinishing(true);
      try {
        useUserStore.getState().loadProfile({ id: u.uid });
        await userRepository.upsertProfile(u.uid, {
          displayName: nickname,
          email: u.email ?? null,
          photoURL: u.photoURL ?? null,
          provider: u.providerData?.some((p) => p.providerId?.includes('google'))
            ? 'google'
            : u.providerData?.some((p) => p.providerId?.includes('apple'))
              ? 'apple'
              : 'unknown',
          profile: { nickname, fullName: nickname, age, avatarId, avatarEmoji: emoji },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : t('onboarding.saveError'));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setFinishing(false);
        return;
      }
      setFinishing(false);
    }

    void logEvent('user_setup_complete', {});
    useAuthStore.getState().login();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(app)/saga');
  };

  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.progressContainer}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              { backgroundColor: i <= step ? colors.brand.primary : colors.materials.highlight },
              i === step && styles.progressDotActive,
            ]}
          />
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
              overline={t('onboarding.stepNameOverline')}
              title={t('onboarding.stepNameTitle')}
              subtitle={t('onboarding.stepNameSubtitle')}
              style={{ alignItems: 'center' }}
            />
            <TextInput
              style={[
                styles.input,
                Typography.headline,
                {
                  color: colors.text.primary,
                  borderColor: colors.materials.border,
                  backgroundColor: colors.materials.highlight,
                },
              ]}
              placeholder={t('onboarding.namePlaceholder')}
              placeholderTextColor={colors.text.tertiary}
              value={name}
              onChangeText={setName}
              maxLength={30}
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
              overline={t('onboarding.stepAgeOverline')}
              title={t('onboarding.stepAgeTitle')}
              subtitle={t('onboarding.stepAgeSubtitle', { minAge: MIN_AGE })}
              style={{ alignItems: 'center' }}
            />
            <TextInput
              style={[
                styles.input,
                Typography.headline,
                {
                  color: colors.text.primary,
                  borderColor: colors.materials.border,
                  backgroundColor: colors.materials.highlight,
                },
              ]}
              placeholder={t('onboarding.agePlaceholder')}
              placeholderTextColor={colors.text.tertiary}
              value={ageText}
              onChangeText={(text) => setAgeText(text.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={3}
              autoFocus
            />
            {ageText.trim() !== '' && parseAge(ageText) === null && (
              <Text style={[styles.hint, { color: colors.system.red }]}>
                {t('onboarding.ageHint', { minAge: MIN_AGE, maxAge: MAX_AGE })}
              </Text>
            )}
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
              overline={t('onboarding.stepAvatarOverline')}
              title={t('onboarding.stepAvatarTitle')}
              subtitle={t('onboarding.stepAvatarSubtitle')}
              style={{ alignItems: 'center' }}
            />
            <View style={styles.avatarGrid}>
              {AVATARS.map((av) => (
                <Bounceable
                  key={av.id}
                  accessibilityRole="button"
                  accessibilityLabel={t('onboarding.selectAvatar')}
                  accessibilityState={{ selected: avatarId === av.id }}
                  onPress={() => {
                    setAvatarId(av.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.avatarButton,
                    {
                      backgroundColor: colors.materials.base,
                      borderColor: colors.materials.border,
                    },
                    avatarId === av.id && {
                      borderColor: colors.brand.primary,
                      backgroundColor: colors.fill.brandSubtle,
                    },
                  ]}
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
              overline={t('onboarding.stepWelcomeOverline')}
              title={t('onboarding.stepWelcomeTitle')}
              subtitle={t('onboarding.stepWelcomeSubtitle')}
              style={{ alignItems: 'center' }}
            />
            <View
              style={[
                styles.finalAvatarContainer,
                {
                  backgroundColor: colors.materials.highlight,
                  borderColor: colors.materials.border,
                },
              ]}
            >
              <Text style={styles.welcomeAvatar}>
                {AVATARS.find((a) => a.id === avatarId)?.emoji ?? '🦁'}
              </Text>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {error !== '' && (
          <Text style={[styles.errorText, { color: colors.system.red }]}>{error}</Text>
        )}
        <CetiButton
          label={step === 3 ? t('onboarding.start') : t('onboarding.next')}
          onPress={handleNext}
          disabled={!canAdvance() || finishing}
          variant="primary"
          size="large"
          style={{ width: '100%' }}
          isLoading={finishing}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 80 },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  progressDot: { width: 10, height: 10, borderRadius: 5 },
  progressDotActive: { width: 24 },
  content: { flexGrow: 1, paddingHorizontal: Spacing.base },
  stepContainer: { alignItems: 'center', paddingTop: 20 },
  input: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    textAlign: 'center',
    borderWidth: 1,
  },
  hint: { ...Typography.caption1, marginTop: Spacing.sm, textAlign: 'center' },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  avatarButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  avatarEmojiText: { fontSize: 40 },
  finalAvatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
    borderWidth: 1,
  },
  welcomeAvatar: { fontSize: 72 },
  footer: { paddingHorizontal: Spacing.base, paddingBottom: 50 },
  errorText: {
    ...Typography.caption1,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
});
