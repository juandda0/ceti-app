import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Typography } from '@shared/constants/typography';
import { Spacing, BorderRadius } from '@shared/constants/theme';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import CetiButton from '@shared/components/CetiButton';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';
import { isFirebaseConfigured } from '@shared/lib/firebase/app';
import {
  configureGoogleSignIn,
  isAppleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
} from '@shared/lib/firebase/oauth';

export default function LoginScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const mode = useThemeStore((s) => s.mode);
  const styles = getStyles(colors, mode);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  const goHome = () => router.replace('/');

  const onGoogle = async () => {
    setError('');
    setBusy(true);
    try {
      await signInWithGoogle();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goHome();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo iniciar sesión';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  const onApple = async () => {
    setError('');
    setBusy(true);
    try {
      await signInWithApple();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goHome();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo iniciar sesión con Apple';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  const offlineContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(auth)/choose-role');
  };

  if (!isFirebaseConfigured()) {
    return (
      <ScreenWrapper style={styles.root}>
        <View style={styles.content}>
          <PageHeader
            overline="Acceso"
            title="Modo local"
            subtitle="No hay proyecto Firebase en las variables EXPO_PUBLIC_FIREBASE_*. Puedes continuar solo en este dispositivo o configurar .env y reiniciar."
            style={{ marginBottom: Spacing['2xl'] }}
          />
          <CetiButton
            label="Continuar sin cuenta"
            onPress={offlineContinue}
            variant="primary"
            size="large"
          />
          <CetiButton
            label="Volver"
            onPress={() => router.back()}
            variant="ghost"
            size="medium"
            style={{ marginTop: Spacing.md }}
          />
        </View>
      </ScreenWrapper>
    );
  }

  const showApple = isAppleSignInAvailable();

  return (
    <ScreenWrapper style={styles.root}>
      <View style={styles.content}>
        <CetiButton
          label="← Volver"
          onPress={() => router.back()}
          variant="ghost"
          size="small"
          style={{ alignSelf: 'flex-start', marginBottom: Spacing.md }}
        />

        <PageHeader
          overline="Cuenta"
          title="Entra a Ceti"
          subtitle="Usa tu cuenta Google (o Apple en iOS) para guardar tu familia en la nube de forma segura."
          style={{ marginBottom: Spacing['2xl'] }}
        />

        {error ? (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: colors.system.red + '22', borderColor: colors.system.red },
            ]}
          >
            <Ionicons name="alert-circle" size={20} color={colors.system.red} />
            <Text style={[styles.errorText, { color: colors.system.red }]}>{error}</Text>
          </View>
        ) : null}

        <CetiButton
          label="Continuar con Google"
          onPress={onGoogle}
          variant="primary"
          size="large"
          disabled={busy}
          isLoading={busy}
        />

        {showApple ? (
          <CetiButton
            label="Continuar con Apple"
            onPress={onApple}
            variant="secondary"
            size="large"
            disabled={busy}
            isLoading={busy}
            style={{ marginTop: Spacing.md }}
          />
        ) : null}

        <Text style={[styles.hint, { color: colors.text.tertiary }]}>
          Al continuar aceptas el uso de tu nombre y correo según la política de privacidad del
          proyecto.
        </Text>
      </View>
    </ScreenWrapper>
  );
}

const getStyles = (colors: ReturnType<typeof useThemeColors>, _mode: string) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background.base,
    },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.xl,
      paddingTop: Platform.OS === 'ios' ? 56 : 40,
      paddingBottom: Spacing['2xl'],
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: Spacing.base,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      marginBottom: Spacing.lg,
    },
    errorText: {
      ...Typography.caption1,
      flex: 1,
      fontWeight: '600',
    },
    hint: {
      ...Typography.caption2,
      textAlign: 'center',
      marginTop: Spacing['2xl'],
      lineHeight: 18,
    },
  });
