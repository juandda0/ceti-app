// WorldOverlay.tsx — HUD de Juego + dock de minijuegos
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Dimensions,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Typography } from '@shared/constants/typography';
import { Spacing } from '@shared/constants/theme';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useReduceMotionShared } from '@shared/hooks/useReduceMotionShared';
import { getLevelForXP, getLevelProgress } from '@shared/data/levels';
import LitFireSvg from '../../../../assets/images/litfire.svg';
import ExtinguishedFireSvg from '../../../../assets/images/extinguishedfire.svg';

const { width } = Dimensions.get('window');

interface WorldOverlayProps {
  playerName: string;
  avatarEmoji: string;
  xp: number;
  totalCetis: number;
  streak: number;
  isStreakActive: boolean;
  coinCatchCooldownUntil: number;
  saveOrSpendCooldownUntil: number;
  onOpenCoinCatch: () => void;
  onOpenSaveOrSpend: () => void;
}

function formatCooldown(untilMs: number): string | null {
  const diff = untilMs - Date.now();
  if (diff <= 0) return null;
  const mins = Math.ceil(diff / 60000);
  if (mins >= 60) return `${Math.ceil(mins / 60)}h`;
  return `${mins}m`;
}

function MinigameButton({
  icon,
  label,
  cooldownLabel,
  onPress,
  hasNew,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  cooldownLabel: string | null;
  onPress: () => void;
  hasNew?: boolean;
}) {
  const colors = useThemeColors();
  const onCooldown = cooldownLabel !== null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        onCooldown ? `${label}, disponible en ${cooldownLabel}` : `Jugar ${label}`
      }
      accessibilityState={{ disabled: onCooldown }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.minigameBtn,
        {
          backgroundColor: onCooldown ? colors.background.secondary : colors.background.primary,
          borderColor: onCooldown ? colors.materials.border : colors.brand.primary,
          opacity: pressed ? 0.75 : onCooldown ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={onCooldown ? colors.text.quaternary : colors.brand.primary}
      />
      <Text
        style={[
          styles.minigameBtnLabel,
          { color: onCooldown ? colors.text.quaternary : colors.text.secondary },
        ]}
      >
        {label}
      </Text>
      {cooldownLabel && (
        <View style={[styles.cooldownBadge, { backgroundColor: colors.background.tertiary }]}>
          <Ionicons name="time-outline" size={10} color={colors.text.quaternary} />
          <Text style={[styles.cooldownText, { color: colors.text.quaternary }]}>
            {cooldownLabel}
          </Text>
        </View>
      )}
      {hasNew && !onCooldown && (
        <View style={[styles.newBadge, { backgroundColor: colors.system.green }]} />
      )}
    </Pressable>
  );
}

export default function WorldOverlay({
  playerName,
  avatarEmoji,
  xp,
  totalCetis,
  streak,
  isStreakActive,
  coinCatchCooldownUntil,
  saveOrSpendCooldownUntil,
  onOpenCoinCatch,
  onOpenSaveOrSpend,
}: WorldOverlayProps) {
  const colors = useThemeColors();
  const router = useRouter();
  const { reduceMotion } = useReduceMotionShared();

  const levelInfo = getLevelForXP(xp);
  const level = levelInfo.level;
  const xpBandProgressPct = getLevelProgress(xp) * 100;
  const xpIntoLevel = Math.max(0, xp - levelInfo.xpRequired);

  const coinCatchCooldown = useMemo(
    () => formatCooldown(coinCatchCooldownUntil),
    [coinCatchCooldownUntil]
  );
  const saveOrSpendCooldown = useMemo(
    () => formatCooldown(saveOrSpendCooldownUntil),
    [saveOrSpendCooldownUntil]
  );

  const flameStyle = useAnimatedStyle(() => {
    if (reduceMotion.value) return { transform: [{ scale: 1 }] };
    return {
      transform: [
        {
          scale: withRepeat(
            withSequence(withTiming(1.06, { duration: 360 }), withTiming(1, { duration: 360 })),
            -1,
            true
          ),
        },
      ],
    };
  });

  const pulseStyle = useAnimatedStyle(() => {
    if (reduceMotion.value) return { transform: [{ scale: 1 }] };
    return {
      transform: [
        {
          scale: withRepeat(
            withSequence(withTiming(1.03, { duration: 440 }), withTiming(1, { duration: 440 })),
            -1,
            true
          ),
        },
      ],
    };
  });

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* ── HUD SUPERIOR ── */}
      <View style={styles.hudHeader}>
        <Animated.View
          entering={motion.enterDown(32)}
          style={[
            styles.heroContainer,
            { borderColor: colors.materials.border, backgroundColor: colors.materials.base },
          ]}
        >
          <View style={styles.avatarFrame}>
            <View style={[styles.avatarGradient, { backgroundColor: colors.brand.primaryDark }]} />
            <View
              style={[
                styles.avatarInner,
                {
                  backgroundColor: colors.background.secondary,
                  borderColor: colors.materials.border,
                },
              ]}
            >
              {avatarEmoji ? (
                <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
              ) : (
                <Ionicons name="person" size={24} color={colors.brand.primary} />
              )}
            </View>
            <View
              style={[
                styles.levelBadge,
                { backgroundColor: colors.brand.primary, borderColor: colors.background.base },
              ]}
            >
              <Text style={[styles.levelText, { color: colors.text.onBrand }]}>{level}</Text>
            </View>
          </View>
          <View style={styles.heroInfo}>
            <Text numberOfLines={1} style={[styles.heroName, { color: colors.text.primary }]}>
              {playerName}
            </Text>
            <View style={styles.xpMiniBar}>
              <View style={[styles.xpMiniBg, { backgroundColor: colors.materials.highlight }]}>
                <View
                  style={[
                    styles.xpMiniFill,
                    { width: `${xpBandProgressPct}%`, backgroundColor: colors.brand.primary },
                  ]}
                />
              </View>
              <Text style={[styles.xpValueText, { color: colors.text.tertiary }]}>
                {xpIntoLevel}/{levelInfo.xpToNext} XP
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={motion.enterDown(72)} style={styles.resources}>
          <View
            style={[
              styles.resourcePill,
              { borderColor: colors.materials.border, backgroundColor: colors.materials.base },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.fill.goldStrong }]}>
              <Ionicons name="sparkles" size={14} color={colors.gold.primary} />
            </View>
            <Text style={[styles.resourceValue, { color: colors.gold.primary }]}>
              {totalCetis.toLocaleString()}
            </Text>
          </View>

          <Animated.View style={flameStyle}>
            <View
              style={[
                styles.resourcePill,
                { borderColor: colors.materials.border, backgroundColor: colors.materials.base },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.fill.orangeStrong }]}>
                {isStreakActive ? (
                  <LitFireSvg width={18} height={18} />
                ) : (
                  <ExtinguishedFireSvg width={18} height={18} />
                )}
              </View>
              <Text style={[styles.resourceValue, { color: colors.system.orange }]}>{streak}</Text>
            </View>
          </Animated.View>
        </Animated.View>
      </View>

      {/* ── BOTÓN APRENDER (prominente, centro-bajo) ── */}
      <Animated.View entering={motion.enterDown(200)} style={styles.primaryActionContainer}>
        <Animated.View style={pulseStyle}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Ir a aprender"
            accessibilityHint="Abre el mapa de lecciones"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.primaryButton, { backgroundColor: colors.brand.primary }]}
            onPress={() => router.push('/(child)/learn')}
            activeOpacity={0.8}
          >
            <Ionicons name="play" size={22} color={colors.text.onBrand} />
            <Text style={[styles.primaryButtonText, { color: colors.text.onBrand }]}>APRENDER</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* ── DOCK INFERIOR: minijuegos ── */}
      <Animated.View entering={motion.enterDown(260)} style={styles.minigameDock}>
        <MinigameButton
          icon="cash"
          label="Coin Catch"
          cooldownLabel={coinCatchCooldown}
          onPress={onOpenCoinCatch}
        />
        <MinigameButton
          icon="git-compare-outline"
          label="Decisiones"
          cooldownLabel={saveOrSpendCooldown}
          onPress={onOpenSaveOrSpend}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 16,
  },
  hudHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    paddingLeft: 4,
    paddingVertical: 4,
    borderRadius: 40,
    borderWidth: 1,
    maxWidth: width * 0.55,
  },
  avatarFrame: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarGradient: { ...StyleSheet.absoluteFillObject, borderRadius: 27 },
  avatarInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  avatarEmoji: { fontSize: 24 },
  levelBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  levelText: { fontSize: 10, fontWeight: '900' },
  heroInfo: { marginLeft: 12, flex: 1 },
  heroName: { ...Typography.headline, fontSize: 14, fontWeight: '800' },
  xpMiniBar: { marginTop: 4, gap: 4 },
  xpMiniBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  xpMiniFill: { height: '100%', borderRadius: 2 },
  xpValueText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  resources: { gap: 8, alignItems: 'flex-end' },
  resourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 4,
    paddingRight: 12,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  resourceValue: { ...Typography.headline, fontSize: 14, fontWeight: '900' },
  primaryActionContainer: {
    position: 'absolute',
    bottom: 130,
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    paddingHorizontal: 28,
    borderRadius: 28,
    gap: 10,
    minWidth: 180,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '900', letterSpacing: 0.8 },
  minigameDock: {
    position: 'absolute',
    bottom: 64,
    left: 16,
    flexDirection: 'row',
    gap: 10,
  },
  minigameBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    position: 'relative',
  },
  minigameBtnLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  cooldownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cooldownText: {
    fontSize: 9,
    fontWeight: '700',
  },
  newBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
