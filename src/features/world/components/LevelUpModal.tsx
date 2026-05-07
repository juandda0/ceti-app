import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@shared/constants/typography';
import { Spacing } from '@shared/constants/theme';
import CetiButton from '@shared/components/CetiButton';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { LEVELS } from '@shared/data/levels';

interface LevelUpModalProps {
  level: number;
  isVisible: boolean;
  onClose: () => void;
}

export default function LevelUpModal({ level, isVisible, onClose }: LevelUpModalProps) {
  const colors = useThemeColors();
  const rankName = LEVELS.find((l) => l.level === level)?.name ?? 'Explorador Ceti';

  return (
    <CetiBottomSheet
      visible={isVisible}
      onClose={onClose}
      title="¡Nuevo nivel!"
      closeOnBackdropPress
    >
      <Animated.View entering={motion.enterDown(20)} style={styles.inner}>
        <View style={[styles.iconWrap, { backgroundColor: colors.fill.goldSubtle }]}>
          <Ionicons name="sparkles-outline" size={40} color={colors.gold.primary} />
        </View>
        <View style={[styles.levelBadge, { backgroundColor: colors.gold.primary }]}>
          <Text style={[styles.levelNumber, { color: colors.text.onGold }]}>{level}</Text>
        </View>
        <Text style={[styles.rankLabel, { color: colors.text.secondary }]}>Tu rango ahora</Text>
        <Text style={[styles.rank, { color: colors.gold.primary }]}>{rankName}</Text>
        <Text style={[styles.description, { color: colors.text.secondary }]}>
          Has demostrado ser un gran administrador de tus Cetis. ¡Sigue así para desbloquear más en
          tu mundo!
        </Text>
        <CetiButton
          label="Continuar"
          onPress={onClose}
          variant="primary"
          size="large"
          style={{ width: '100%' }}
        />
      </Animated.View>
    </CetiBottomSheet>
  );
}

const styles = StyleSheet.create({
  inner: { alignItems: 'center', gap: Spacing.md, paddingBottom: Spacing.sm },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelNumber: { ...Typography.displayNumberMedium },
  rankLabel: {
    ...Typography.caption1,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  rank: { ...Typography.title2, fontWeight: '900', textAlign: 'center' },
  description: {
    ...Typography.body,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
});
