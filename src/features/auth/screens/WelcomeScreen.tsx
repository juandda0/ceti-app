// app/(auth)/welcome.tsx — Bienvenida de marca: fondo naranja y Ceti saliendo del portal
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { Typography } from '@shared/constants/typography';
import { Spacing } from '@shared/constants/theme';
import { BrandColors } from '@shared/constants/colors';
import CetiButton from '@shared/components/CetiButton';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { motionMs } from '@shared/constants/motion';
import { CetiEntradaReposo } from '@features/animations';
import { useTranslation } from 'react-i18next';
import { showMessage } from '@shared/lib/dialogs';
import { configureGoogleSignIn, signInWithGoogle } from '@shared/lib/firebase/oauth';
import { loginIntent, type LoginIntent } from '@features/auth/data/loginIntent';

// Ceti sale del portal, da la vuelta y cae asomada hacia los ~2 s; el texto entra cuando ya cayó.
const TEXT_DELAY = 1450;
const BUTTON_DELAY = 1700;

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // Rol con el que se está entrando (muestra la carga en su botón).
  const [entrando, setEntrando] = useState<LoginIntent | null>(null);

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  // El rol elegido viaja como intención (D-ADMIN): el servidor crea el colegio del
  // profe; el estudiante sigue al ingreso por código. Luego decide el resolver (/).
  const entrar = async (rol: LoginIntent) => {
    if (entrando) return;
    loginIntent.set(rol);
    setEntrando(rol);
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Cerrar el selector de Google no es un error que haya que avisar.
      if (!/cancelad/i.test(msg)) showMessage(t('welcome.errorTitulo'), msg, 'error');
    } finally {
      setEntrando(null);
    }
  };

  const contentOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(30);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    contentOpacity.value = withDelay(TEXT_DELAY, withTiming(1, { duration: motionMs.fade }));
    buttonOpacity.value = withDelay(BUTTON_DELAY, withTiming(1, { duration: motionMs.fade }));
    buttonTranslateY.value = withDelay(
      BUTTON_DELAY,
      withTiming(0, { duration: motionMs.fade, easing: Easing.out(Easing.cubic) })
    );
  }, [contentOpacity, buttonOpacity, buttonTranslateY]);

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  return (
    <ScreenWrapper style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.centerColumn}>
        <View style={styles.heroBlock}>
          <CetiEntradaReposo
            entrada="mascot.ceti-portal-entrada"
            reposo="mascot.ceti-portal-reposo"
            size={280}
          />

          <Animated.View style={[styles.textContainer, contentAnimatedStyle]}>
            <Text style={styles.overline}>{t('welcome.overline').toUpperCase()}</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {t('welcome.title')}
            </Text>
            <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
          </Animated.View>

          <Animated.View style={[styles.buttonContainer, buttonAnimatedStyle]}>
            <CetiButton
              label={t('welcome.ctaEstudiante')}
              icon="rocket"
              onPress={() => void entrar('estudiante')}
              variant="onBrand"
              size="large"
              isLoading={entrando === 'estudiante'}
              disabled={entrando === 'profesor'}
            />
            <CetiButton
              label={t('welcome.ctaProfe')}
              icon="school"
              onPress={() => void entrar('profesor')}
              variant="onBrand"
              size="large"
              isLoading={entrando === 'profesor'}
              disabled={entrando === 'estudiante'}
              style={{ marginTop: Spacing.md }}
            />
            <Pressable
              onPress={() => router.push('/(auth)/institucion' as Href)}
              accessibilityRole="button"
              hitSlop={8}
              style={styles.correo}
            >
              <Text style={styles.correoTexto}>{t('welcome.ctaInstitucion')}</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(auth)/login')}
              accessibilityRole="button"
              hitSlop={8}
              style={styles.correo}
            >
              <Text style={styles.correoTexto}>{t('welcome.ctaCorreo')}</Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>

      <Animated.Text
        entering={FadeIn.duration(motionMs.fade).delay(BUTTON_DELAY + 140)}
        style={styles.footer}
      >
        {t('welcome.footer')}
      </Animated.Text>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.orange,
  },
  centerColumn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  heroBlock: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  overline: {
    ...Typography.caption1,
    color: BrandColors.ink,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.largeTitle,
    color: BrandColors.ink,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: BrandColors.ink,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  buttonContainer: {
    alignSelf: 'stretch',
    width: '100%',
  },
  correo: { alignSelf: 'center', marginTop: Spacing.lg, paddingVertical: Spacing.xs },
  correoTexto: {
    ...Typography.caption1,
    color: BrandColors.ink,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  footer: {
    ...Typography.caption2,
    color: BrandColors.ink,
    textAlign: 'center',
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
});
