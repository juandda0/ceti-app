// components/wallet/CetisDisplay.tsx — Display de Cetis sin emojis y con estilo Spatial UI
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { 
  FadeInUp,
  FadeOutUp
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Shadows, Spacing } from '@/constants/theme';

interface CetisDisplayProps {
  amount: number;
  showLabel?: boolean;
}

export default function CetisDisplay({ 
  amount, 
  showLabel = true 
}: CetisDisplayProps) {
  const previousAmount = useRef(amount);
  const diff = amount - previousAmount.current;
  
  useEffect(() => {
    previousAmount.current = amount;
  }, [amount]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Ionicons name="cash-outline" size={32} color={Colors.gold.primary} style={styles.icon} />
        <Text style={[styles.number, Typography.displayNumberMedium]}>
          {amount}
        </Text>
        {showLabel && (
          <Text style={[styles.label, Typography.title3]}>Cetis</Text>
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
            { color: diff > 0 ? Colors.system.green : Colors.system.red }
          ]}>
            {diff > 0 ? `+${diff}` : diff}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: Colors.gold.primary,
    // Eliminamos Shadows directos para usar glows en el padre si es necesario
  },
  label: {
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
    marginTop: 10,
  },
  diffContainer: {
    position: 'absolute',
    top: -20,
    right: -20,
  },
  diffText: {
    // Ya usa Typography.headline
  },
});
