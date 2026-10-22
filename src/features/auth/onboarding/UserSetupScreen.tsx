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
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { logEvent } from '@shared/lib/analytics/logEvent';
import { getFirebaseClients, isFirebaseConfigured } from '@shared/lib/firebase/app';
import { userRepository } from '@features/auth/data/userRepository';
import AvatarView from '@features/avatar/components/AvatarView';
import { SelectorColor, SelectorPersonaje } from '@features/avatar/components/Selectores';
import {
  AVATAR_POR_DEFECTO,
  muestrasPelo,
  muestrasPiel,
  personajePorId,
  type AvatarConfig,
} from '@features/avatar/domain/catalogo';

export default function UserSetupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const setProfile = useUserStore((s) => s.setProfile);
  const colors = useThemeColors();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<AvatarConfig>(AVATAR_POR_DEFECTO);
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);

  // Steps: 0 = name, 1 = avatar, 2 = welcome
  const canAdvance = useCallback(() => {
    if (step === 0) return name.trim().length >= 2;
    return true;
  }, [step, name]);

  const handleNext = () => {
    if (!canAdvance() || step >= 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError('');
    setStep(step + 1);
  };

  const finishSetup = async () => {
    const nickname = name.trim();

    setProfile(nickname, nickname, avatar);

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
          profile: {
            nickname,
            fullName: nickname,
            avatarId: avatar.personaje,
            avatarEmoji: '',
            avatar,
          },
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
    router.replace('/');
  };

  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.progressContainer}>
        {[0, 1, 2].map((i) => (
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
            <View style={[styles.escenario, { backgroundColor: colors.materials.base }]}>
              <View style={[styles.halo, { backgroundColor: colors.fill.brandSubtle }]} />
              <AvatarView config={avatar} size={112} />
              <Text style={[styles.rol, { color: colors.text.secondary }]}>
                {t(`avatar.rol.${personajePorId(avatar.personaje).rol}`)}
              </Text>
            </View>
            <View style={styles.selectores}>
              <SelectorPersonaje
                config={avatar}
                onChange={(personaje) => setAvatar((a) => ({ ...a, personaje }))}
              />
              <SelectorColor
                titulo={t('avatar.tonoPiel')}
                opciones={muestrasPiel(avatar)}
                valor={avatar.tono}
                onChange={(tono) => setAvatar((a) => ({ ...a, tono }))}
                etiqueta={(id) => t(`avatar.tono.${id}`)}
              />
              <SelectorColor
                titulo={t('avatar.colorPelo')}
                opciones={muestrasPelo(avatar)}
                valor={avatar.pelo}
                onChange={(pelo) => setAvatar((a) => ({ ...a, pelo }))}
                etiqueta={(id) => t(`avatar.pelo.${id}`)}
              />
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
              <AvatarView config={avatar} encuadre="retrato" size={116} />
            </View>
          </Animated.View>
        )}

      </ScrollView>

      <View style={styles.footer}>
        {error !== '' && (
          <Text style={[styles.errorText, { color: colors.system.red }]}>{error}</Text>
        )}
        {step <= 2 && (
          <CetiButton
            label={step === 2 ? t('onboarding.start') : t('onboarding.next')}
            onPress={step === 2 ? () => void finishSetup() : handleNext}
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
  escenario: {
    width: '100%',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderRadius: 28,
    alignItems: 'center',
    overflow: 'hidden',
  },
  halo: { position: 'absolute', bottom: 18, width: 104, height: 104, borderRadius: 52 },
  rol: { ...Typography.subheadline, fontWeight: '700', marginTop: 4 },
  selectores: { width: '100%', gap: Spacing.sm, marginTop: Spacing.sm },
  finalAvatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
    borderWidth: 1,
  },
  footer: { paddingHorizontal: Spacing.base, paddingBottom: 50 },
  errorText: {
    ...Typography.caption1,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
});
