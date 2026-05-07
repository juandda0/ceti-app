// WorldRocket.tsx — Capa de interacción del cohete (Pressable invisible + chip)
// El dibujo real del cohete vive en WorldCanvas → rocketSkia.tsx
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { getIslandLayout } from './WorldCanvas';
import { ROCKET_DIMS } from './world/rocketSkia';
import type { WorldId } from '../data/worlds';
import { WORLDS } from '../data/worlds';

interface WorldRocketProps {
  worldId: WorldId;
  canTravel: boolean;
  hasNext: boolean;
  nextWorldName?: string;
  bobOffset: SharedValue<number>;
  onTap: () => void;
}

export default function WorldRocket({
  worldId,
  canTravel,
  hasNext,
  nextWorldName,
  bobOffset,
  onTap,
}: WorldRocketProps) {
  const colors = useThemeColors();

  const layout = getIslandLayout(worldId);
  const world = WORLDS[worldId];
  const rocketAbsX = layout.cx + (world.sprites.rocketX - 0.5) * layout.islandW;
  const rocketBaseY = layout.cy - ROCKET_DIMS.bodyH - 18 + world.sprites.rocketYOffset;

  // El Pressable se mueve con el bobbing para coincidir con el dibujo Skia
  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bobOffset.value }],
  }));

  const chipBg = canTravel ? colors.fill.greenStrong : colors.background.tertiary;
  const chipBorder = canTravel ? colors.system.green : colors.materials.border;
  const chipText = canTravel ? colors.system.green : colors.text.quaternary;

  if (!hasNext) return null;

  return (
    <Animated.View
      style={[
        styles.root,
        bobStyle,
        {
          left: rocketAbsX - ROCKET_DIMS.width / 2,
          top: rocketBaseY - ROCKET_DIMS.bodyH,
        },
      ]}
    >
      <Pressable
        onPress={onTap}
        accessibilityRole="button"
        accessibilityLabel={nextWorldName ? `Viajar a ${nextWorldName}` : 'Cohete'}
        accessibilityHint="Abre el panel de viaje al siguiente planeta"
        accessibilityState={{ disabled: !canTravel }}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        style={styles.pressable}
      >
        {/* Área transparente que cubre el dibujo Skia del cohete */}
        <View style={{ width: ROCKET_DIMS.width, height: ROCKET_DIMS.bodyH + 20 }} />

        {/* Chip de estado bajo el cohete */}
        <View style={[styles.chip, { backgroundColor: chipBg, borderColor: chipBorder }]}>
          <Ionicons name={canTravel ? 'arrow-forward' : 'lock-closed'} size={11} color={chipText} />
          <Text style={[styles.chipText, { color: chipText }]} numberOfLines={1}>
            {canTravel ? 'Viajar' : nextWorldName}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 20,
  },
  pressable: {
    alignItems: 'center',
    gap: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 120,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '800',
    flexShrink: 1,
  },
});
