// app/(child)/profile.tsx — Perfil Dinámico y Motivador para Niños
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@shared/constants/typography';
import { useChildStore } from '@features/auth/store/useChildStore';
import ChildUnitScreenLayout from '@shared/components/child/ChildUnitScreenLayout';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { getLevelForXP, getLevelProgress } from '@shared/data/levels';

import { useAuthStore } from '@features/auth/store/useAuthStore';

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
    useChildStore();
  const logout = useAuthStore((s) => s.logout);
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/choose-role');
  };

  const levelMeta = getLevelForXP(xp);
  const levelProgressPct = getLevelProgress(xp) * 100;
  const xpIntoLevel = Math.max(0, xp - levelMeta.xpRequired);

  return (
    <ChildUnitScreenLayout
      kicker="Mi progreso"
      title="Mi perfil"
      subtitle={`${nickname}${fullName && fullName !== nickname ? ` · ${fullName}` : ''}`}
      chip={`Nv. ${level}`}
    >
      <View style={styles.stack}>
        {/* Hero de Nivel (Enfoque en Progreso) */}
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

          <Text style={styles.nameText}>{nickname}</Text>
          <Text style={[styles.levelName, { color: colors.brand.primary }]}>
            Nivel {level}: {levelMeta.name}
          </Text>

          <View style={styles.xpSection}>
            <View style={styles.xpHeader}>
              <Text style={styles.xpLabel}>Próximo nivel</Text>
              <Text style={styles.xpValue}>
                {xpIntoLevel} / {levelMeta.xpToNext} XP
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${levelProgressPct}%` as any, backgroundColor: colors.brand.primary },
                ]}
              />
            </View>
          </View>
        </Animated.View>

        {/* Stats Amigables (Pocas y claras) */}
        <View style={styles.statsRow}>
          <Animated.View entering={motion.enterDown(88)} style={styles.statBox}>
            <Ionicons name="flame" size={28} color={colors.system.orange} />
            <Text style={styles.statNum}>{streak}</Text>
            <Text style={styles.statLabel}>DÍAS SEGUIDOS</Text>
          </Animated.View>
          <Animated.View entering={motion.enterDown(112)} style={styles.statBox}>
            <Ionicons name="book" size={28} color={colors.system.blue} />
            <Text style={styles.statNum}>{totalLessonsCompleted}</Text>
            <Text style={styles.statLabel}>LECCIONES</Text>
          </Animated.View>
          <Animated.View entering={motion.enterDown(136)} style={styles.statBox}>
            <Ionicons name="sparkles" size={28} color={colors.gold.primary} />
            <Text style={styles.statNum}>{xp}</Text>
            <Text style={styles.statLabel}>XP TOTAL</Text>
          </Animated.View>
        </View>

        {/* Mis Logros (Visual y divertido) */}
        <Animated.View entering={motion.enterDown(152)} style={styles.section}>
          <Text style={styles.sectionTitle}>Mis Logros</Text>
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
                <View style={[styles.badgeIcon, { backgroundColor: colors.materials.highlight }]}>
                  <Ionicons name={badge.icon as any} size={32} color={badge.color} />
                </View>
                <Text style={styles.badgeTitle}>{badge.title}</Text>
              </View>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Opciones de Salida */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.system.red} />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </ChildUnitScreenLayout>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    stack: { gap: 22 },

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
    levelNumber: { color: colors.text.onBrand, fontSize: 18, fontWeight: '900' },

    nameText: {
      ...Typography.title1,
      color: colors.text.primary,
      fontWeight: '900',
      marginTop: 12,
    },
    levelName: {
      ...Typography.headline,
      fontWeight: '800',
      marginTop: 4,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },

    xpSection: { width: '100%', gap: 8 },
    xpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    xpLabel: { ...Typography.caption1, color: colors.text.tertiary, fontWeight: '700' },
    xpValue: { ...Typography.caption1, color: colors.brand.primary, fontWeight: '800' },
    progressBar: {
      height: 12,
      backgroundColor: colors.materials.highlight,
      borderRadius: 6,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 6 },

    statsRow: { flexDirection: 'row', gap: 12 },
    statBox: {
      flex: 1,
      backgroundColor: colors.materials.base,
      borderRadius: 24,
      padding: 16,
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: colors.materials.border,
    },
    statNum: { ...Typography.title2, color: colors.text.primary, fontWeight: '900' },
    statLabel: {
      ...Typography.caption1,
      color: colors.text.tertiary,
      fontWeight: '800',
      textAlign: 'center',
      fontSize: 10,
      letterSpacing: 0.5,
    },

    section: { gap: 16 },
    sectionTitle: { ...Typography.title3, color: colors.text.primary, fontWeight: '800' },
    badgesScroll: { gap: 16, paddingRight: 20 },
    badgeCard: { alignItems: 'center', gap: 8 },
    badgeIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.materials.border,
    },
    badgeTitle: { ...Typography.caption2, color: colors.text.secondary, fontWeight: '700' },

    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    logoutText: { ...Typography.caption1, color: colors.system.red, fontWeight: '700' },
  });
