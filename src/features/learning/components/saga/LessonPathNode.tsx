import { View, TouchableOpacity, StyleSheet, type GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '@shared/constants/colors';

export type LessonNodeStatus = 'completed' | 'current' | 'locked';

export interface LessonPathNodeProps {
  status: LessonNodeStatus;
  iconName: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  translateX: number;
  onPress?: (event: GestureResponderEvent) => void;
  colors: ThemeColors;
}

/** Nodo del camino: anillo + disco con el icono de la lección. */
export default function LessonPathNode({
  status,
  iconName,
  accentColor,
  translateX,
  onPress,
  colors,
}: LessonPathNodeProps) {
  const isCompleted = status === 'completed';
  const isCurrent = status === 'current';
  const isLocked = status === 'locked';

  return (
    <View style={[styles.wrapper, { transform: [{ translateX }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={(e) => {
          if (!isLocked) onPress?.(e);
        }}
        disabled={isLocked}
        style={[
          styles.outerRing,
          isCompleted && {
            backgroundColor: colors.brand.primary,
            borderColor: colors.brand.primary,
          },
          isCurrent && {
            backgroundColor: colors.background.elevated,
            borderColor: colors.brand.primary,
            borderWidth: 4,
          },
          isLocked && {
            backgroundColor: colors.background.tertiary,
            borderColor: colors.materials.border,
            borderWidth: 2,
          },
        ]}
      >
        <View
          style={[
            styles.innerDisc,
            isCompleted && { backgroundColor: colors.brand.chipBackdrop },
            isCurrent && { backgroundColor: colors.brand.primary },
            isLocked && { backgroundColor: colors.background.secondary },
          ]}
        >
          {isCompleted ? (
            <Ionicons name="checkmark" size={32} color={colors.text.onBrand} />
          ) : (
            <Ionicons
              name={iconName}
              size={28}
              color={
                isLocked ? colors.text.quaternary : isCurrent ? colors.text.onBrand : accentColor
              }
            />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  innerDisc: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
