// components/world/WorldOverlay.tsx — HUD de Juego de Alto Impacto (Expert Game UI)
import React from 'react';
import { View, Text, StyleSheet, Platform, Dimensions, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@shared/constants/typography';
import { useThemeStore } from '@shared/store/useThemeStore';
import { useThemeColors } from '@shared/hooks/useThemeColors';

const { width } = Dimensions.get('window');

interface WorldOverlayProps {
  playerName: string;
  avatarEmoji: string;
  xp: number;
  totalCetis: number;
  streak: number;
}

const BLUR_INTENSITY = Platform.OS === 'android' ? 60 : 40;

export default function WorldOverlay({
  playerName,
  avatarEmoji,
  xp,
  totalCetis,
  streak,
}: WorldOverlayProps) {
  const mode = useThemeStore(s => s.mode);
  const toggleTheme = useThemeStore(s => s.toggleTheme);
  const colors = useThemeColors();
  
  const level = Math.floor(xp / 100) + 1;
  const currentLevelXP = xp % 100;

  // Animación de pulso para la racha (fuego)
  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withRepeat(withSequence(withTiming(1.1, { duration: 800 }), withTiming(1, { duration: 800 })), -1, true) }]
  }));

  return (
    <View style={styles.container} pointerEvents="box-none">
      
      {/* ── HUD SUPERIOR ── */}
      <View style={styles.hudHeader}>
        
        {/* PERFIL DEL HÉROE */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={[styles.heroContainer, { borderColor: colors.materials.border, backgroundColor: colors.materials.base }]}>
          <View style={styles.avatarFrame}>
          <View 
            style={[styles.avatarGradient, { backgroundColor: colors.brand.primary }]} 
          />
            <View style={[styles.avatarInner, { backgroundColor: colors.background.secondary, borderColor: colors.materials.border }]}>
              {avatarEmoji ? (
                <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
              ) : (
                <Ionicons name="person" size={24} color={colors.brand.primary} />
              )}
            </View>
            <View style={[styles.levelBadge, { backgroundColor: colors.brand.primary, borderColor: colors.background.base }]}>
              <Text style={[styles.levelText, { color: colors.text.onBrand }]}>{level}</Text>
            </View>
          </View>
          <View style={styles.heroInfo}>
            <Text numberOfLines={1} style={[styles.heroName, { color: colors.text.primary }]}>{playerName}</Text>
            <View style={styles.xpMiniBar}>
              <View style={[styles.xpMiniBg, { backgroundColor: colors.separator.transparent }]}>
                <View style={[styles.xpMiniFill, { width: `${currentLevelXP}%`, backgroundColor: colors.brand.primary }]} />
              </View>
              <Text style={[styles.xpValueText, { color: colors.text.tertiary }]}>{currentLevelXP}/100 XP</Text>
            </View>
          </View>
        </Animated.View>

        {/* CLUSTER DE RECURSOS */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.resources}>
          {/* BOTÓN MODO CLARO/OSCURO */}
          <TouchableOpacity 
            style={[styles.themeToggle, { backgroundColor: colors.materials.base, borderColor: colors.materials.border }]} 
            onPress={toggleTheme}
          >
            <Ionicons name={mode === 'light' ? 'moon' : 'sunny'} size={18} color={colors.brand.primary} />
          </TouchableOpacity>

          {/* CETIS */}
          <View style={[styles.resourcePill, { borderColor: colors.materials.border, backgroundColor: colors.materials.base }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.gold.primary + '20' }]}>
              <Ionicons name="sparkles" size={14} color={colors.gold.primary} />
            </View>
            <Text style={[styles.resourceValue, { color: colors.gold.primary }]}>{totalCetis}</Text>
          </View>

          {/* RACHA */}
          <Animated.View style={[styles.resourcePill, flameStyle, { borderColor: colors.materials.border, backgroundColor: colors.materials.base }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.system.orange + '20' }]}>
              <Ionicons name="flame" size={14} color={colors.system.orange} />
            </View>
            <Text style={[styles.resourceValue, { color: colors.system.orange }]}>{streak}</Text>
          </Animated.View>
        </Animated.View>

      </View>

      {/* ── MENSAJE DE BIENVENIDA (OPCIONAL/SUBTIL) ── */}
      <Animated.View entering={FadeInDown.delay(600).duration(1000)} style={[styles.floatingHint, { borderColor: colors.materials.border }]}>
        <BlurView intensity={BLUR_INTENSITY} tint={mode === 'light' ? 'light' : 'dark'} style={styles.hintBlur}>
          <Text style={[styles.hintText, { color: colors.text.secondary }]}>Toca un edificio para interactuar</Text>
        </BlurView>
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

  // ── Perfil Heroico ──
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
  avatarGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 27,
    opacity: 0.8,
  },
  avatarInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  avatarEmoji: {
    fontSize: 24,
  },
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
  levelText: {
    fontSize: 10,
    fontWeight: '900',
  },
  heroInfo: {
    marginLeft: 12,
    flex: 1,
  },
  heroName: {
    ...Typography.headline,
    fontSize: 14,
    fontWeight: '800',
  },
  xpMiniBar: {
    marginTop: 4,
    gap: 4,
  },
  xpMiniBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  xpMiniFill: {
    height: '100%',
    borderRadius: 2,
  },
  xpValueText: {
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  // ── Recursos Cluster ──
  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 8,
  },
  resources: {
    gap: 8,
    alignItems: 'flex-end',
  },
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
  resourceValue: {
    ...Typography.headline,
    fontSize: 14,
    fontWeight: '900',
  },

  // ── Hint Flotante ──
  floatingHint: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  hintBlur: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  hintText: {
    ...Typography.caption1,
    fontWeight: '600',
  },
});
