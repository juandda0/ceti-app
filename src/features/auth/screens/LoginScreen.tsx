import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { safeRouterBack } from '@shared/utils/safeRouterBack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Typography } from '@shared/constants/typography';
import { Spacing, BorderRadius } from '@shared/constants/theme';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import CetiButton from '@shared/components/CetiButton';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';
import { isBackendConfigured } from '@shared/lib/api/client';
import { signInDev } from '@shared/lib/auth/session';
import { loginIntent } from '@features/auth/data/loginIntent';
import { configureGoogleSignIn, signInWithGoogle } from '@shared/lib/auth/oauth';

// Solo desarrollo/E2E: el backend además lo rechaza salvo CETI_DEV_LOGIN=true.
const DEV_LOGIN = (Constants.expoConfig?.extra as { devLogin?: boolean } | undefined)?.devLogin === true;

export default function LoginScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const mode = useThemeStore((s) => s.mode);
  const styles = getStyles(colors, mode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [devEmail, setDevEmail] = useState('');

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  const goHome = () => router.replace('/');

  const doSignIn = async (signIn: () => Promise<unknown>) => {
    setError('');
    setBusy(true);
    try {
      await signIn();
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

  const onGoogle = () => {
    loginIntent.set('estudiante');
    void doSignIn(signInWithGoogle);
  };

  const onDevLogin = () => {
    loginIntent.set('estudiante');
    void doSignIn(() => signInDev(devEmail.trim()));
  };

  if (!isBackendConfigured()) {
    return (
      <ScreenWrapper style={styles.root}>
        <View style={styles.content}>
          <PageHeader
            overline="Acceso"
            title="Modo local"
            subtitle="El acceso con Google no está disponible en este entorno. Configura EXPO_PUBLIC_API_URL y vuelve a intentarlo."
            style={{ marginBottom: Spacing['2xl'] }}
          />
          <CetiButton
            label="Volver"
            onPress={() => safeRouterBack(router, '/(auth)/welcome')}
            variant="ghost"
            size="medium"
            style={{ marginTop: Spacing.md }}
          />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={styles.root}>
      <View style={styles.content}>
        <CetiButton
          label="← Volver"
          onPress={() => safeRouterBack(router, '/(auth)/welcome')}
          variant="ghost"
          size="small"
          style={{ alignSelf: 'flex-start', marginBottom: Spacing.md }}
        />

        <PageHeader
          overline="Cuenta"
          title="Entra a Ceti"
          subtitle="Usa tu cuenta de Google para guardar tu progreso de forma segura."
          style={{ marginBottom: Spacing['2xl'] }}
        />

        {error ? (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: colors.system.red + '22', borderColor: colors.system.red },
            ]}
          >
            <Ionicons
              name="alert-circle"
              size={20}
              color={colors.system.red}
              style={styles.errorIcon}
            />
            <ScrollView
              style={styles.errorScroll}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <Text style={[styles.errorText, { color: colors.system.red }]}>{error}</Text>
            </ScrollView>
          </View>
        ) : null}

        <CetiButton
          label="Entrar como invitado"
          icon="logo-google"
          onPress={onGoogle}
          variant="primary"
          size="large"
          disabled={busy}
          isLoading={busy}
        />

        {DEV_LOGIN ? (
          <View style={styles.devBox}>
            <TextInput
              value={devEmail}
              onChangeText={setDevEmail}
              placeholder="correo@ejemplo.test"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              keyboardType="email-address"
              accessibilityLabel="Correo para entrar en modo desarrollo"
              style={[styles.devInput, { color: colors.text.primary, borderColor: colors.materials.highlight }]}
            />
            <CetiButton
              label="Entrar (modo desarrollo)"
              onPress={onDevLogin}
              variant="ghost"
              size="medium"
              disabled={busy || !devEmail.includes('@')}
            />
          </View>
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
      alignItems: 'flex-start',
      gap: 8,
      padding: Spacing.base,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      marginBottom: Spacing.lg,
      maxHeight: 240,
    },
    errorIcon: {
      marginTop: 2,
    },
    errorScroll: {
      flex: 1,
      flexShrink: 1,
    },
    errorText: {
      ...Typography.caption1,
      fontWeight: '600',
      lineHeight: 20,
    },
    devBox: {
      marginTop: Spacing.lg,
      gap: Spacing.sm,
    },
    devInput: {
      borderWidth: 1,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.sm,
      ...Typography.body,
    },
    hint: {
      ...Typography.caption2,
      textAlign: 'center',
      marginTop: Spacing['2xl'],
      lineHeight: 18,
    },
  });
