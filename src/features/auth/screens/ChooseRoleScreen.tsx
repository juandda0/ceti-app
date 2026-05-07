// app/(auth)/choose-role.tsx — Elige Padre o Hijo antes del login / registro (solo caché local)
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Typography } from '@shared/constants/typography';
import { Spacing, BorderRadius } from '@shared/constants/theme';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';
import { useChildStore } from '@features/auth/store/useChildStore';
import { isFirebaseConfigured } from '@shared/lib/firebase/app';

export default function ChooseRoleScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const mode = useThemeStore((s) => s.mode);
  const styles = getStyles(colors, mode);
  const isChildOnboarded = useChildStore((s) => s.isOnboarded);

  const goParent = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(auth)/onboarding/parent-setup');
  };

  const goChild = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isChildOnboarded) {
      router.push('/(auth)/child-entry');
    } else {
      router.push('/(auth)/onboarding/child-setup');
    }
  };

  return (
    <ScreenWrapper style={styles.root}>
      <View style={styles.content}>
        <PageHeader
          overline="Acceso"
          title="¿Quién eres?"
          subtitle={
            isFirebaseConfigured()
              ? 'Primera vez con esta cuenta: elige cómo vas a usar Ceti. Podrás enlazar dispositivos con tu familia en la nube.'
              : 'Elige tu tipo de cuenta para continuar. Los datos se guardan solo en este dispositivo.'
          }
          style={{ marginBottom: Spacing.xl }}
        />

        <Animated.View entering={motion.enterDown(48)} style={styles.cards}>
          <TouchableOpacity
            style={[
              styles.roleCard,
              { borderColor: colors.materials.border, backgroundColor: colors.materials.base },
            ]}
            onPress={goParent}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Acceso como padre o tutor"
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.fill.blueSubtle }]}>
              <Ionicons name="shield-checkmark" size={28} color={colors.system.blue} />
            </View>
            <View style={styles.roleTextCol}>
              <Text style={[styles.roleTitle, { color: colors.text.primary }]}>Padre o tutor</Text>
              <Text style={[styles.roleSub, { color: colors.text.secondary }]}>
                Panel familiar, tareas y aprobaciones
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.roleCard,
              { borderColor: colors.materials.border, backgroundColor: colors.materials.base },
            ]}
            onPress={goChild}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Acceso como niño o niña"
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.fill.brandSubtle }]}>
              <Ionicons name="sparkles" size={28} color={colors.brand.primary} />
            </View>
            <View style={styles.roleTextCol}>
              <Text style={[styles.roleTitle, { color: colors.text.primary }]}>Niño o niña</Text>
              <Text style={[styles.roleSub, { color: colors.text.secondary }]}>
                {isChildOnboarded ? 'Entra con tu perfil guardado' : 'Crea tu perfil y tu mundo'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.text.tertiary} />
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={styles.backLink}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={18} color={colors.text.tertiary} />
          <Text style={[styles.backText, { color: colors.text.tertiary }]}>Volver</Text>
        </TouchableOpacity>
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
    content: {
      flex: 1,
      paddingHorizontal: Spacing.xl,
      paddingTop: Platform.OS === 'ios' ? 72 : 56,
      paddingBottom: Spacing['2xl'],
    },
    cards: {
      gap: Spacing.md,
    },
    roleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.base,
      padding: Spacing.lg,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: BorderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    roleTextCol: {
      flex: 1,
      gap: 4,
    },
    roleTitle: {
      ...Typography.title3,
      fontWeight: '800',
    },
    roleSub: {
      ...Typography.caption1,
      fontWeight: '500',
    },
    backLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: Spacing['2xl'],
      alignSelf: 'flex-start',
      paddingVertical: Spacing.sm,
    },
    backText: {
      ...Typography.subheadline,
      fontWeight: '600',
    },
  });
