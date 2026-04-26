// components/wallet/CetisDisplay.tsx — Display de Cetis sin emojis y con estilo Spatial UI
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { 
  FadeInUp,
  FadeOutUp
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import { Spacing } from '@shared/constants/theme';

interface CetisDisplayProps {
  amount: number;
  showLabel?: boolean;
}

export default function CetisDisplay({ 
  amount, 
  showLabel = true 
}: CetisDisplayProps) {
  const colors = useThemeColors();
  const previousAmount = useRef(amount);
  const diff = amount - previousAmount.current;
  
  useEffect(() => {
    previousAmount.current = amount;
  }, [amount]);

  const styles = getStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Ionicons name="cash-outline" size={32} color={colors.gold.primary} style={styles.icon} />
        <Text style={[styles.number, Typography.displayNumberMedium, { color: colors.gold.primary }]}>
          {amount}
        </Text>
        {showLabel && (
          <Text style={[styles.label, Typography.title3, { color: colors.text.secondary }]}>Cetis</Text>
        )}
      </View>

      {diff !== 0 && (
        <Animated.View 
          key={`${amount}-${diff}`}
          entering={FadeInUp.delay(100)} 
          exiting={FadeOutUp} 
          style={styles.diffContainer}
        >
          <Text style={[
            styles.diffText, 
            Typography.headline,
            { color: diff > 0 ? colors.system.green : colors.system.red }
          ]}>
            {diff > 0 ? `+${diff}` : diff}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: Spacing.sm,
  },
  number: {
    color: colors.gold.primary,
  },
  label: {
    color: colors.text.secondary,
    marginLeft: Spacing.sm,
    marginTop: 10,
  },
  diffContainer: {
    position: 'absolute',
    top: -20,
    right: -20,
  },
  diffText: {
  },
});
