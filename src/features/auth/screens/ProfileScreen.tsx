import { Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@shared/constants/typography';
import { Spacing } from '@shared/constants/theme';
import { useUserStore } from '@features/auth/store/useUserStore';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { performLogoutAndGo } from '@features/auth/performLogout';

const AVATARS: Record<string, string> = {
  avatar_1: '🦁',
  avatar_2: '🐸',
  avatar_3: '🦊',
  avatar_4: '🐼',
  avatar_5: '🐱',
  avatar_6: '🐶',
  avatar_7: '🦄',
  avatar_8: '🐨',
};

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { nickname, fullName, avatarId, avatarEmoji } = useUserStore();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = getStyles(colors);

  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 8) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text
          entering={motion.enterSoftFade()}
          style={[styles.pageTitle, { color: colors.text.primary }]}
        >
          {t('profile.pageTitle')}
        </Animated.Text>

        <Animated.View entering={motion.enterFadeUp(1)} style={styles.levelCard}>
          <Animated.View
            entering={motion.enterSoftScale(120)}
            style={[styles.avatarCircle, { borderColor: colors.brand.primary }]}
          >
            {avatarEmoji || AVATARS[avatarId] ? (
              <Text style={styles.avatarText}>{avatarEmoji || AVATARS[avatarId]}</Text>
            ) : (
              <Ionicons name="person" size={40} color={colors.brand.primary} />
            )}
          </Animated.View>

          <Text style={[styles.nameText, { color: colors.text.primary }]}>{nickname}</Text>
          {fullName && fullName !== nickname ? (
            <Text style={[styles.fullNameText, { color: colors.text.secondary }]}>{fullName}</Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={motion.enterFadeUp(2)}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => void performLogoutAndGo(router, '/(auth)/welcome')}
            accessibilityRole="button"
            accessibilityLabel={t('profile.logout')}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.system.red} />
            <Text style={[styles.logoutText, { color: colors.system.red }]}>
              {t('profile.logout')}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background.base },
    scroll: { paddingHorizontal: Spacing.base, paddingBottom: 120, gap: 22 },
    pageTitle: { ...Typography.largeTitle, fontWeight: '900', marginBottom: 8 },

    levelCard: {
      backgroundColor: colors.materials.base,
      borderRadius: 36,
      padding: 32,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.materials.border,
    },
    avatarCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.materials.highlight,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      marginBottom: 16,
    },
    avatarText: { fontSize: 54 },
    nameText: { ...Typography.title1, fontWeight: '900', marginTop: 12 },
    fullNameText: { ...Typography.subheadline, marginTop: 2 },

    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 8,
    },
    logoutText: { ...Typography.caption1, fontWeight: '700' },
  });
