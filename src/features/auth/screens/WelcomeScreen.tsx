// app/(auth)/welcome.tsx — Welcome screen with smooth transitions
import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withRepeat,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { Typography } from '@shared/constants/typography';
import { Spacing } from '@shared/constants/theme';
import CetiButton from '@shared/components/CetiButton';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';
import { lottieSpeed, motionMs } from '@shared/constants/motion';
import { useTranslation } from 'react-i18next';
import { isFirebaseConfigured } from '@shared/lib/firebase/app';

const piggyCoinsAnimation = require('../../../../assets/lottie/piggy-coins-out.json');

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const mode = useThemeStore((s) => s.mode);
  const styles = getStyles(colors, mode);

  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(30);
  const buttonOpacity = useSharedValue(0);
  const logoPulse = useSharedValue(1);

  useEffect(() => {
    const logoStart = 100;
    logoScale.value = withDelay(
      logoStart,
      withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) })
    );
    logoOpacity.value = withDelay(logoStart, withTiming(1, { duration: 240 }));
    contentOpacity.value = withDelay(280, withTiming(1, { duration: motionMs.fade }));
    buttonOpacity.value = withDelay(420, withTiming(1, { duration: motionMs.fade }));
    buttonTranslateY.value = withDelay(
      420,
      withTiming(0, { duration: motionMs.fade, easing: Easing.out(Easing.cubic) })
    );

    logoPulse.value = withRepeat(
      withTiming(1.015, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value * logoPulse.value }],
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  const handleLogin = () => {
    router.push('/(auth)/login');
  };

  const handleOffline = () => {
    router.push('/(auth)/choose-role');
  };

  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.centerColumn}>
        <View style={styles.heroBlock}>
          <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
            <LottieView
              source={piggyCoinsAnimation}
              speed={lottieSpeed.subtle}
              autoPlay
              loop={false}
              style={styles.logoLottie}
            />
          </Animated.View>

          <Animated.View style={[styles.textContainer, contentAnimatedStyle]}>
            <PageHeader
              overline={t('welcome.overline')}
              title={t('welcome.title')}
              subtitle={t('welcome.subtitle')}
              showAccentLine={false}
              style={{ alignItems: 'center' }}
            />
          </Animated.View>

          <Animated.View style={[styles.buttonContainer, buttonAnimatedStyle]}>
            <CetiButton
              label={t('welcome.ctaStart')}
              onPress={handleLogin}
              variant="primary"
              size="large"
            />
            <CetiButton
              label={t('welcome.ctaHasAccount')}
              onPress={handleLogin}
              variant="ghost"
              size="medium"
              style={{ marginTop: Spacing.sm }}
            />
            {!isFirebaseConfigured() ? (
              <CetiButton
                label={t('welcome.ctaOffline')}
                onPress={handleOffline}
                variant="secondary"
                size="medium"
                style={{ marginTop: Spacing.md }}
              />
            ) : null}
          </Animated.View>
        </View>
      </View>

      <Animated.Text entering={FadeIn.duration(motionMs.fade).delay(560)} style={styles.version}>
        {t('welcome.footer')}
      </Animated.Text>
    </ScreenWrapper>
  );
}

const getStyles = (colors: any, _mode: string) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.base,
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
    logoContainer: {
      marginBottom: Spacing.md,
      alignItems: 'center',
    },
    logoLottie: {
      width: 220,
      height: 220,
    },
    textContainer: {
      alignItems: 'center',
      width: '100%',
      marginBottom: Spacing.lg,
    },
    buttonContainer: {
      alignSelf: 'stretch',
      width: '100%',
    },
    version: {
      ...Typography.caption2,
      color: colors.text.tertiary,
      textAlign: 'center',
      paddingBottom: Spacing.lg,
      paddingHorizontal: Spacing.lg,
    },
  });
