// src/features/savings/screens/AssignRewardScreen.tsx — Asignar Cetis (padre)
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Typography } from '@shared/constants/typography';
import { BorderRadius, Spacing } from '@shared/constants/theme';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import CetiButton from '@shared/components/CetiButton';
import CetiCard from '@shared/components/CetiCard';
import Bounceable from '@shared/components/Bounceable';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { formatMoneyInputThousands, parseMoneyAmountInt } from '@shared/utils/moneyInputFormat';

const MAX_CETI_DIGITS = 6;

export default function AssignRewardScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const earnCetis = useWalletStore((s) => s.earnCetis);

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    const num = parseMoneyAmountInt(amount);
    if (!num || num < 1) return;
    earnCetis(num, reason.trim() || 'Regalo de Papá/Mamá', 'parent_gift');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(true);
  };

  if (sent) {
    const displayAmount = parseMoneyAmountInt(amount);
    return (
      <ScreenWrapper
        style={[styles(colors).container, { backgroundColor: colors.background.base }]}
      >
        <Animated.View entering={motion.zoomIn} style={styles(colors).successContainer}>
          <Ionicons
            name="checkmark-circle"
            size={80}
            color={colors.brand.primary}
            style={{ marginBottom: Spacing.lg }}
          />
          <Text
            style={[styles(colors).successTitle, Typography.title1, { color: colors.text.primary }]}
          >
            ¡Cetis enviados!
          </Text>
          <Text
            style={[
              styles(colors).successAmount,
              Typography.displayNumberMedium,
              { color: colors.gold.primary },
            ]}
          >
            +{displayAmount.toLocaleString('es-CO')}
          </Text>

          <CetiButton
            label="Volver al dashboard"
            onPress={() => router.back()}
            variant="primary"
            size="large"
            style={{ width: '100%', marginTop: Spacing['2xl'] }}
          />
        </Animated.View>
      </ScreenWrapper>
    );
  }

  const parsed = parseMoneyAmountInt(amount);
  const isValid = parsed > 0;

  return (
    <ScreenWrapper style={[styles(colors).container, { backgroundColor: colors.background.base }]}>
      <View style={styles(colors).header}>
        <Bounceable onPress={() => router.back()}>
          <Ionicons
            name="chevron-back"
            size={24}
            color={colors.text.tertiary}
            style={{ marginBottom: 8 }}
          />
        </Bounceable>
        <PageHeader
          overline="Recompensa"
          title="Asignar Cetis"
          subtitle="Envía Cetis como recompensa especial"
        />
      </View>

      <Animated.View entering={motion.enterDown(64)}>
        <CetiCard variant="regular" style={styles(colors).form}>
          <Text style={[styles(colors).label, Typography.headline]}>Cantidad</Text>
          <View
            style={[
              styles(colors).amountInputContainer,
              {
                backgroundColor: colors.background.secondary,
                borderColor: colors.materials.border,
              },
            ]}
          >
            <Ionicons name="cash-outline" size={32} color={colors.gold.primary} />
            <TextInput
              style={[
                styles(colors).amountInput,
                Typography.displayNumberMedium,
                { color: colors.gold.primary },
              ]}
              placeholder="0"
              placeholderTextColor={colors.text.tertiary}
              value={amount}
              onChangeText={(t) => setAmount(formatMoneyInputThousands(t, MAX_CETI_DIGITS))}
              keyboardType="number-pad"
              accessibilityLabel="Cantidad de Cetis a enviar"
            />
          </View>

          <Text style={[styles(colors).label, Typography.headline, { marginTop: Spacing.base }]}>
            Razón (opcional)
          </Text>
          <TextInput
            style={[
              styles(colors).reasonInput,
              Typography.body,
              {
                backgroundColor: colors.background.secondary,
                color: colors.text.primary,
                borderColor: colors.materials.border,
              },
            ]}
            placeholder="Ej: Por portarse bien"
            placeholderTextColor={colors.text.tertiary}
            value={reason}
            onChangeText={setReason}
            maxLength={50}
          />

          <CetiButton
            label="Enviar Cetis"
            onPress={handleSend}
            variant="primary"
            size="large"
            disabled={!isValid}
            style={{ marginTop: Spacing.xl }}
          />
        </CetiCard>
      </Animated.View>
    </ScreenWrapper>
  );
}

const styles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: Spacing.base,
      paddingTop: 80,
    },
    header: { marginBottom: Spacing['2xl'] },
    form: { padding: Spacing.lg, borderColor: colors.materials.border },
    label: { color: colors.text.secondary },
    amountInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.lg,
      marginVertical: Spacing.sm,
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
    },
    amountInput: {
      textAlign: 'center',
      minWidth: 100,
    },
    reasonInput: {
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginTop: Spacing.xs,
      borderWidth: StyleSheet.hairlineWidth,
    },
    successContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
    },
    successTitle: { marginBottom: 8, textAlign: 'center' },
    successAmount: {},
  });
