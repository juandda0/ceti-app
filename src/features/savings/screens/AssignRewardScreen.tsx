// app/(parent)/assign-reward.tsx — Asignar Cetis con transiciones suaves
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@shared/constants/colors';
import { Typography } from '@shared/constants/typography';
import { BorderRadius, Spacing } from '@shared/constants/theme';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import CetiButton from '@shared/components/CetiButton';
import CetiCard from '@shared/components/CetiCard';
import Bounceable from '@shared/components/Bounceable';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';

export default function AssignRewardScreen() {
  const router = useRouter();
  const earnCetis = useWalletStore((s) => s.earnCetis);

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    const num = parseInt(amount);
    if (!num || num < 1) return;
    earnCetis(num, reason.trim() || 'Regalo de Papá/Mamá', 'parent_gift');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(true);
  };

  if (sent) {
    return (
      <ScreenWrapper style={styles.container}>
        <Animated.View entering={ZoomIn.springify()} style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={80} color={Colors.brand.primary} style={{ marginBottom: Spacing.lg }} />
          <Text style={[styles.successTitle, Typography.title1]}>¡Cetis enviados!</Text>
          <Text style={[styles.successAmount, Typography.displayNumberMedium]}>+{amount}</Text>
          
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

  const isValid = amount && parseInt(amount) > 0;

  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.header}>
        <Bounceable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text.tertiary} style={{ marginBottom: 8 }} />
        </Bounceable>
        <PageHeader 
          overline="Recompensa"
          title="Asignar Cetis"
          subtitle="Envía Cetis como recompensa especial"
        />
      </View>

      <Animated.View entering={FadeInDown.delay(200)}>
        <CetiCard variant="elevated" style={styles.form}>
          <Text style={[styles.label, Typography.headline]}>Cantidad</Text>
          <View style={styles.amountInputContainer}>
            <Ionicons name="cash-outline" size={32} color={Colors.gold.primary} />
            <TextInput
              style={[styles.amountInput, Typography.displayNumberMedium]}
              placeholder="0"
              placeholderTextColor={Colors.text.tertiary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>

          <Text style={[styles.label, Typography.headline, { marginTop: Spacing.base }]}>Razón (opcional)</Text>
          <TextInput
            style={[styles.reasonInput, Typography.body]}
            placeholder="Ej: Por portarse bien"
            placeholderTextColor={Colors.text.tertiary}
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

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors.background.primary, 
    paddingHorizontal: Spacing.base, 
    paddingTop: 80 
  },
  header: { marginBottom: Spacing['2xl'] },
  title: { color: Colors.text.primary },
  subtitle: { color: Colors.text.secondary, marginTop: 4 },
  form: { padding: Spacing.lg },
  label: { color: Colors.text.secondary },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.tertiary, 
    borderRadius: BorderRadius.xl, 
    paddingHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    gap: 8,
  },
  amountInput: { 
    color: Colors.gold.primary, 
    textAlign: 'center',
    minWidth: 80,
  },
  reasonInput: { 
    backgroundColor: Colors.background.tertiary, 
    borderRadius: BorderRadius.lg, 
    padding: Spacing.md, 
    color: Colors.text.primary,
    marginTop: Spacing.xs,
  },
  successContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  successTitle: { color: Colors.text.primary, marginBottom: 8, textAlign: 'center' },
  successAmount: { color: Colors.gold.primary },
});
