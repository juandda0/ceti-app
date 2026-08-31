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
import ClassCodeForm from '@features/dashboard/components/ClassCodeForm';
import { joinClass } from '@features/dashboard/data/joinClass';
import { pendingInvite } from '@features/dashboard/data/pendingInvite';

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

export default function UserSetupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const setProfile = useUserStore((s) => s.setProfile);
  const colors = useThemeColors();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState('');
  const [classCode] = useState(() => pendingInvite.consume() ?? '');
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);

  // Steps: 0 = name, 1 = avatar, 2 = welcome, 3 = optional class code
  const canAdvance = useCallback(() => {
    if (step === 0) return name.trim().length >= 2;
    if (step === 1) return avatarId !== '';
    return true;
  }, [step, name, avatarId]);

  const handleNext = () => {
    if (!canAdvance() || step >= 3) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError('');
    setStep(step + 1);
  };

  const finishSetup = async (code?: string) => {
    const emoji = AVATARS.find((a) => a.id === avatarId)?.emoji ?? '🦁';
    const nickname = name.trim();

    setProfile(nickname, nickname, avatarId, emoji);

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
          profile: { nickname, fullName: nickname, avatarId, avatarEmoji: emoji },
        });
        if (code) await joinClass(code);
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
    // Rutar por el gate central (index) — NO directo a la saga: un estudiante
    // recién registrado sin curso debe ver la pantalla de código, igual que al
    // re-loguear. Saltarse el gate aquí era el bug de "primera vez entra directo".
    router.replace('/');
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

        {step === 2 && (
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

        {step === 3 && (
          <Animated.View
            key="class-code"
            entering={motion.stepEnter}
            exiting={motion.stepExit}
            style={styles.stepContainer}
          >
            <ClassCodeForm
              initialCode={classCode}
              autoSubmit={classCode !== ''}
              onJoin={(code) => finishSetup(code)}
              onSkip={() => finishSetup()}
            />
          </Animated.View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {error !== '' && (
          <Text style={[styles.errorText, { color: colors.system.red }]}>{error}</Text>
        )}
        {step < 3 && (
          <CetiButton
            label={t('onboarding.next')}
            onPress={handleNext}
            disabled={!canAdvance() || finishing}
            variant="primary"
            size="large"
            style={{ width: '100%' }}
            isLoading={finishing}
          />
        )}
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
