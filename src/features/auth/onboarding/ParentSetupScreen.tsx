// app/(auth)/onboarding/parent-setup.tsx — Parent setup with smooth transitions
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import * as Haptics from 'expo-haptics';
import { Typography } from '@shared/constants/typography';
import { BorderRadius, Spacing } from '@shared/constants/theme';
import { useParentStore } from '@features/family/store/useParentStore';
import CetiButton from '@shared/components/CetiButton';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';

import { useAuthStore } from '@features/auth/store/useAuthStore';
import { logEvent } from '@shared/lib/analytics/logEvent';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { userRepository } from '@features/auth/data/userRepository';
import { familyRepository } from '@features/family/data/FamilyRepository';
import { callSyncUserClaims } from '@shared/lib/firebase/cloudFunctions';

export default function ParentSetupScreen() {
  const router = useRouter();
  const { isPinSet, setPin, verifyPin, setParentName, setFamilyId } = useParentStore();
  const { loginAsParent } = useAuthStore();
  const colors = useThemeColors();
  const mode = useThemeStore((s) => s.mode);
  const styles = getStyles(colors, mode);

  const [step, setStep] = useState(isPinSet ? 'verify' : 'name');
  const [name, setName] = useState('');
  const [pin, setPinValue] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  const handleNameNext = () => {
    if (name.trim().length < 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setParentName(name.trim());
    const uid = useAuthStore.getState().firebaseUid;
    if (uid) setFamilyId(uid);
    setStep('create_pin');
  };

  const handleCreatePin = () => {
    if (pin.length !== 4) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('confirm_pin');
  };

  const handleConfirmPin = async () => {
    if (confirmPin !== pin) {
      setError('Los PINs no coinciden');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setConfirmPin('');
      return;
    }
    const clients = getFirebaseClients();
    const u = clients?.auth.currentUser;
    if (!u) {
      setError('Sesión expirada. Vuelve a iniciar sesión.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await setPin(confirmPin);
    const displayName = useParentStore.getState().parentName.trim();
    const provider = u.providerData?.some((p) => p.providerId?.includes('google'))
      ? 'google'
      : u.providerData?.some((p) => p.providerId?.includes('apple'))
        ? 'apple'
        : 'unknown';
    await userRepository.upsertParentProfile(u.uid, {
      displayName,
      email: u.email ?? null,
      photoURL: u.photoURL ?? null,
      phone: null,
      provider,
    });
    await familyRepository.upsertSeed(u.uid, {
      id: u.uid,
      parentUid: u.uid,
      parentDisplayName: displayName,
      createdAt: Date.now(),
    });
    setFamilyId(u.uid);
    try {
      await callSyncUserClaims();
      await u.getIdToken(true);
    } catch {
      /* claims pueden propagarse en el siguiente arranque */
    }
    void logEvent('parent_pin_set', {});
    loginAsParent();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(parent)/dashboard');
  };

  const handleVerifyPin = async () => {
    if (await verifyPin(pin)) {
      loginAsParent();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(parent)/dashboard');
    } else {
      setError('PIN incorrecto');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPinValue('');
    }
  };

  return (
    <ScreenWrapper style={styles.container}>
      {step === 'verify' && (
        <Animated.View
          key="verify"
          entering={motion.stepEnter}
          exiting={motion.stepExit}
          style={styles.stepContainer}
        >
          <PageHeader
            overline="Seguridad"
            title="Ingresa tu PIN"
            subtitle="Escribe tu PIN de 4 dígitos para acceder"
            style={{ alignItems: 'center' }}
          />
          <TextInput
            style={[styles.pinInput, Typography.title1]}
            placeholder="0000"
            placeholderTextColor={colors.text.tertiary}
            value={pin}
            onChangeText={(t) => {
              setPinValue(t);
              setError('');
            }}
            maxLength={4}
            keyboardType="number-pad"
            secureTextEntry
            autoFocus
          />
          {error !== '' && <Text style={[styles.error, Typography.caption1]}>{error}</Text>}
          <CetiButton
            label="Entrar"
            onPress={handleVerifyPin}
            disabled={pin.length !== 4}
            variant="primary"
            size="large"
            style={{ width: '100%', marginTop: Spacing.xl }}
          />
        </Animated.View>
      )}

      {step === 'name' && (
        <Animated.View
          key="name"
          entering={motion.stepEnter}
          exiting={motion.stepExit}
          style={styles.stepContainer}
        >
          <PageHeader
            overline="Perfil"
            title="¿Cómo te llamas?"
            subtitle="Nombre del padre o tutor"
            style={{ alignItems: 'center' }}
          />
          <TextInput
            style={[styles.input, Typography.headline]}
            placeholder="Tu nombre..."
            placeholderTextColor={colors.text.tertiary}
            value={name}
            onChangeText={setName}
            maxLength={30}
            autoFocus
          />
          <CetiButton
            label="Siguiente"
            onPress={handleNameNext}
            disabled={name.trim().length < 2}
            variant="primary"
            size="large"
            style={{ width: '100%', marginTop: Spacing.xl }}
          />
        </Animated.View>
      )}

      {step === 'create_pin' && (
        <Animated.View
          key="create"
          entering={motion.stepEnter}
          exiting={motion.stepExit}
          style={styles.stepContainer}
        >
          <PageHeader
            overline="Seguridad"
            title="Crea un PIN"
            subtitle="4 dígitos para proteger tu panel"
            style={{ alignItems: 'center' }}
          />
          <TextInput
            style={[styles.pinInput, Typography.title1]}
            placeholder="0000"
            placeholderTextColor={colors.text.tertiary}
            value={pin}
            onChangeText={setPinValue}
            maxLength={4}
            keyboardType="number-pad"
            secureTextEntry
            autoFocus
          />
          <CetiButton
            label="Siguiente"
            onPress={handleCreatePin}
            disabled={pin.length !== 4}
            variant="primary"
            size="large"
            style={{ width: '100%', marginTop: Spacing.xl }}
          />
        </Animated.View>
      )}

      {step === 'confirm_pin' && (
        <Animated.View
          key="confirm"
          entering={motion.stepEnter}
          exiting={motion.stepExit}
          style={styles.stepContainer}
        >
          <PageHeader
            overline="Seguridad"
            title="Confirma tu PIN"
            subtitle="Repite el PIN para asegurar que sea correcto"
            style={{ alignItems: 'center' }}
          />
          <TextInput
            style={[styles.pinInput, Typography.title1]}
            placeholder="0000"
            placeholderTextColor={colors.text.tertiary}
            value={confirmPin}
            onChangeText={(t) => {
              setConfirmPin(t);
              setError('');
            }}
            maxLength={4}
            keyboardType="number-pad"
            secureTextEntry
            autoFocus
          />
          {error !== '' && <Text style={[styles.error, Typography.caption1]}>{error}</Text>}
          <CetiButton
            label="Finalizar"
            onPress={handleConfirmPin}
            disabled={confirmPin.length !== 4}
            variant="primary"
            size="large"
            style={{ width: '100%', marginTop: Spacing.xl }}
          />
        </Animated.View>
      )}
    </ScreenWrapper>
  );
}

const getStyles = (colors: any, mode: string) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.base,
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
    },
    stepContainer: { alignItems: 'center' },
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
    pinInput: {
      width: 240,
      backgroundColor: colors.materials.highlight,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      color: colors.text.primary,
      textAlign: 'center',
      borderWidth: 1,
      borderColor: colors.materials.border,
      letterSpacing: 12,
    },
    error: { color: colors.system.red, marginTop: Spacing.sm },
  });
