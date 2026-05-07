// Pantalla de acceso para un perfil infantil ya guardado en caché (sin contraseña en MVP)
import { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import * as Haptics from 'expo-haptics';
import { Typography } from '@shared/constants/typography';
import { Spacing } from '@shared/constants/theme';
import CetiButton from '@shared/components/CetiButton';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';
import { useChildStore } from '@features/auth/store/useChildStore';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { resetChildScopedPersistedState } from '@shared/session/localPersistedState';

const AVATAR_EMOJI: Record<string, string> = {
  avatar_1: '🦁',
  avatar_2: '🐸',
  avatar_3: '🦊',
  avatar_4: '🐼',
  avatar_5: '🐱',
  avatar_6: '🐶',
  avatar_7: '🦄',
  avatar_8: '🐨',
};

export default function ChildEntryScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const mode = useThemeStore((s) => s.mode);
  const styles = getStyles(colors, mode);
  const { nickname, avatarId, avatarEmoji, isOnboarded } = useChildStore();
  const loginAsChild = useAuthStore((s) => s.loginAsChild);

  const emoji = avatarEmoji || AVATAR_EMOJI[avatarId] || '🦁';

  useEffect(() => {
    if (!isOnboarded) {
      router.replace('/(auth)/onboarding/child-setup');
    }
  }, [isOnboarded, router]);

  const handleEnter = () => {
    if (!isOnboarded) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    loginAsChild();
    router.replace('/(child)/world');
  };

  if (!isOnboarded) {
    return null;
  }

  return (
    <ScreenWrapper style={styles.root}>
      <View style={styles.inner}>
        <PageHeader
          overline="Hola de nuevo"
          title={nickname || 'Explorador'}
          subtitle="Tu mundo y tus Cetis te esperan en este dispositivo."
          style={{ alignItems: 'center', marginBottom: Spacing['2xl'] }}
        />

        <Animated.View
          entering={motion.enterDown(56)}
          style={[styles.avatarBubble, { borderColor: colors.materials.border }]}
        >
          <Text style={styles.emojiHuge}>{emoji}</Text>
        </Animated.View>

        <Animated.View entering={motion.enterDown(96)} style={styles.actions}>
          <CetiButton
            label="Entrar a mi mundo"
            onPress={handleEnter}
            variant="primary"
            size="large"
          />
          <CetiButton
            label="No soy yo — crear perfil nuevo"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              resetChildScopedPersistedState();
              router.replace('/(auth)/onboarding/child-setup');
            }}
            variant="ghost"
            size="medium"
            style={{ marginTop: Spacing.sm }}
          />
        </Animated.View>

        <Text style={[styles.note, { color: colors.text.tertiary }]}>
          En este modo los datos solo están en este teléfono o tablet.
        </Text>
      </View>
    </ScreenWrapper>
  );
}

const getStyles = (colors: any, _mode: string) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background.base,
    },
    inner: {
      flex: 1,
      paddingHorizontal: Spacing.xl,
      paddingTop: Platform.OS === 'ios' ? 56 : 40,
      alignItems: 'center',
    },
    avatarBubble: {
      width: 132,
      height: 132,
      borderRadius: 66,
      backgroundColor: colors.materials.highlight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing['2xl'],
      borderWidth: 1,
    },
    emojiHuge: {
      fontSize: 72,
    },
    actions: {
      alignSelf: 'stretch',
      width: '100%',
      maxWidth: 400,
    },
    note: {
      ...Typography.caption2,
      textAlign: 'center',
      marginTop: Spacing.xl,
      paddingHorizontal: Spacing.base,
    },
  });
