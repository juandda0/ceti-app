// app/(auth)/welcome.tsx — Bienvenida de marca: fondo naranja y Ceti saliendo del portal
import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
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
import { CetiAnimation } from '@features/animations';
import { useTranslation } from 'react-i18next';

// Ceti termina de salir del portal hacia el ~1.2 s; el texto entra justo después para no competir.
const TEXT_DELAY = 900;
const BUTTON_DELAY = 1100;

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

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
          <CetiAnimation id="brand.ceti-portal" size={260} />

          <Animated.View style={[styles.textContainer, contentAnimatedStyle]}>
            <Text style={styles.overline}>{t('welcome.overline').toUpperCase()}</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {t('welcome.title')}
            </Text>
            <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
          </Animated.View>

          <Animated.View style={[styles.buttonContainer, buttonAnimatedStyle]}>
            <CetiButton
              label={t('welcome.ctaStart')}
              onPress={() => router.push('/(auth)/login')}
              variant="onBrand"
              size="large"
            />
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
  footer: {
    ...Typography.caption2,
    color: BrandColors.ink,
    textAlign: 'center',
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
});
