// app/(auth)/welcome.tsx — Welcome screen with smooth transitions
import { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  withRepeat,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@shared/constants/typography';
import { Spacing } from '@shared/constants/theme';
import CetiButton from '@shared/components/CetiButton';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const mode = useThemeStore(s => s.mode);
  const styles = getStyles(colors, mode);

  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(30);
  const buttonOpacity = useSharedValue(0);
  const logoPulse = useSharedValue(1);

  useEffect(() => {
    logoScale.value = withDelay(400, withSpring(1, { damping: 15, stiffness: 150 }));
    logoOpacity.value = withDelay(400, withTiming(1, { duration: 800 }));
    contentOpacity.value = withDelay(1000, withTiming(1, { duration: 1000 }));
    buttonOpacity.value = withDelay(1600, withTiming(1, { duration: 800 }));
    buttonTranslateY.value = withDelay(1600, withSpring(0, { damping: 20 }));

    logoPulse.value = withRepeat(
      withTiming(1.03, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
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

  const handleStart = () => {
    router.push('/(auth)/select-profile');
  };

  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <View style={styles.logoInner}>
            <Ionicons name="leaf" size={60} color={colors.brand.primary} />
          </View>
        </Animated.View>

        <Animated.View style={[styles.textContainer, contentAnimatedStyle]}>
          <PageHeader 
            overline="Innovación"
            title="Ceti"
            subtitle="Tu mundo crece con tus decisiones"
            style={{ alignItems: 'center' }}
          />
        </Animated.View>
      </View>

      <Animated.View style={[styles.buttonContainer, buttonAnimatedStyle]}>
        <CetiButton 
          label="Empezar" 
          onPress={handleStart} 
          variant="primary" 
          size="large"
        />
        <CetiButton 
          label="Ya tengo cuenta" 
          onPress={handleStart} 
          variant="ghost" 
          size="medium"
          style={{ marginTop: Spacing.sm }}
        />
      </Animated.View>

      <Animated.Text
        entering={FadeIn.delay(2500)}
        style={styles.version}
      >
        Diseñado para el futuro de la educación financiera
      </Animated.Text>
    </ScreenWrapper>
  );
}

const getStyles = (colors: any, mode: string) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background.base 
  },
  content: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  logoContainer: { 
    marginBottom: Spacing.xl,
    alignItems: 'center' 
  },
  logoInner: { 
    width: 120, 
    height: 120, 
    borderRadius: 40, 
    backgroundColor: colors.materials.base, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: colors.materials.border 
  },
  textContainer: { 
    alignItems: 'center' 
  },
  buttonContainer: { 
    paddingHorizontal: Spacing['2xl'], 
    paddingBottom: Spacing['3xl'] 
  },
  version: { 
    ...Typography.caption2, 
    color: colors.text.tertiary, 
    textAlign: 'center', 
    paddingBottom: Spacing.lg 
  },
});
