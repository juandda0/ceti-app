import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@shared/constants/typography';
import { Spacing } from '@shared/constants/theme';
import { useUserStore } from '@features/auth/store/useUserStore';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { getLevelForXP, getLevelProgress } from '@shared/data/levels';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
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
  const { nickname, fullName, avatarId, avatarEmoji, xp, streak, totalLessonsCompleted, level } =
    useUserStore();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = getStyles(colors);

  const levelMeta = getLevelForXP(xp);
  const levelProgressPct = getLevelProgress(xp) * 100;
  const xpIntoLevel = Math.max(0, xp - levelMeta.xpRequired);

  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 8) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: colors.text.primary }]}>Mi perfil</Text>

        <Animated.View entering={motion.enterDown(56)} style={styles.levelCard}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatarCircle, { borderColor: colors.brand.primary }]}>
              {avatarEmoji || AVATARS[avatarId] ? (
                <Text style={styles.avatarText}>{avatarEmoji || AVATARS[avatarId]}</Text>
              ) : (
                <Ionicons name="person" size={40} color={colors.brand.primary} />
              )}
            </View>
            <View
              style={[
                styles.levelBadge,
                { backgroundColor: colors.brand.primary, borderColor: colors.background.secondary },
              ]}
            >
              <Text style={styles.levelNumber}>{level}</Text>
            </View>
          </View>

          <Text style={[styles.nameText, { color: colors.text.primary }]}>{nickname}</Text>
          {fullName && fullName !== nickname ? (
            <Text style={[styles.fullNameText, { color: colors.text.secondary }]}>{fullName}</Text>
          ) : null}
          <Text style={[styles.levelName, { color: colors.brand.primary }]}>
            Nivel {level}: {levelMeta.name}
          </Text>

          <View style={styles.xpSection}>
            <View style={styles.xpHeader}>
              <Text style={[styles.xpLabel, { color: colors.text.tertiary }]}>Próximo nivel</Text>
              <Text style={[styles.xpValue, { color: colors.brand.primary }]}>
                {xpIntoLevel} / {levelMeta.xpToNext} XP
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.materials.highlight }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${levelProgressPct}%` as any, backgroundColor: colors.brand.primary },
                ]}
              />
            </View>
          </View>
        </Animated.View>

        <View style={styles.statsRow}>
          <Animated.View
            entering={motion.enterDown(88)}
            style={[
              styles.statBox,
              { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
            ]}
          >
            <Ionicons name="flame" size={28} color={colors.system.orange} />
            <Text style={[styles.statNum, { color: colors.text.primary }]}>{streak}</Text>
            <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>RACHA</Text>
          </Animated.View>
          <Animated.View
            entering={motion.enterDown(112)}
            style={[
              styles.statBox,
              { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
            ]}
          >
            <Ionicons name="book" size={28} color={colors.system.blue} />
            <Text style={[styles.statNum, { color: colors.text.primary }]}>
              {totalLessonsCompleted}
            </Text>
            <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>LECCIONES</Text>
          </Animated.View>
          <Animated.View
            entering={motion.enterDown(136)}
            style={[
              styles.statBox,
              { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
            ]}
          >
            <Ionicons name="sparkles" size={28} color={colors.gold.primary} />
            <Text style={[styles.statNum, { color: colors.text.primary }]}>{xp}</Text>
            <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>XP TOTAL</Text>
          </Animated.View>
        </View>

        <Animated.View entering={motion.enterDown(152)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Logros</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgesScroll}
          >
            {[
              { icon: 'ribbon', color: colors.gold.primary, title: '¡Hola Ceti!' },
              { icon: 'wallet', color: colors.system.green, title: 'Ahorrador' },
              { icon: 'school', color: colors.system.purple, title: 'Alumno' },
              { icon: 'star', color: colors.system.blue, title: 'Estrella' },
            ].map((badge, i) => (
              <View key={i} style={styles.badgeCard}>
                <View
                  style={[
                    styles.badgeIcon,
                    {
                      backgroundColor: colors.materials.highlight,
                      borderColor: colors.materials.border,
                    },
                  ]}
                >
                  <Ionicons name={badge.icon as any} size={32} color={badge.color} />
                </View>
                <Text style={[styles.badgeTitle, { color: colors.text.secondary }]}>
                  {badge.title}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Animated.View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => void performLogoutAndGo(router, '/(auth)/welcome')}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.system.red} />
          <Text style={[styles.logoutText, { color: colors.system.red }]}>Cerrar sesión</Text>
        </TouchableOpacity>
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
    avatarContainer: { position: 'relative', marginBottom: 16 },
    avatarCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.materials.highlight,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
    },
    avatarText: { fontSize: 54 },
    levelBadge: {
      position: 'absolute',
      bottom: -5,
      right: -5,
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
    },
    levelNumber: { color: '#fff', fontSize: 18, fontWeight: '900' },
    nameText: { ...Typography.title1, fontWeight: '900', marginTop: 12 },
    fullNameText: { ...Typography.subheadline, marginTop: 2 },
    levelName: {
      ...Typography.headline,
      fontWeight: '800',
      marginTop: 4,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },

    xpSection: { width: '100%', gap: 8, marginTop: Spacing.lg },
    xpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    xpLabel: { ...Typography.caption1, fontWeight: '700' },
    xpValue: { ...Typography.caption1, fontWeight: '800' },
    progressBar: { height: 12, borderRadius: 6, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 6 },

    statsRow: { flexDirection: 'row', gap: 12 },
    statBox: {
      flex: 1,
      borderRadius: 24,
      padding: 16,
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
    },
    statNum: { ...Typography.title2, fontWeight: '900' },
    statLabel: {
      ...Typography.caption1,
      fontWeight: '800',
      textAlign: 'center',
      fontSize: 10,
      letterSpacing: 0.5,
    },

    section: { gap: 16 },
    sectionTitle: { ...Typography.title3, fontWeight: '800' },
    badgesScroll: { gap: 16, paddingRight: 20 },
    badgeCard: { alignItems: 'center', gap: 8 },
    badgeIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
    },
    badgeTitle: { ...Typography.caption2, fontWeight: '700' },

    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 8,
    },
    logoutText: { ...Typography.caption1, fontWeight: '700' },
  });
