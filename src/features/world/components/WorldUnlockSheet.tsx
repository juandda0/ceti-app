// WorldUnlockSheet.tsx — Bottom sheet para viajar al siguiente mundo
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import CetiButton from '@shared/components/CetiButton';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import { Spacing } from '@shared/constants/theme';
import type { WorldDefinition } from '../data/worlds';

interface WorldUnlockSheetProps {
  visible: boolean;
  onClose: () => void;
  nextWorld: WorldDefinition | null;
  totalCetis: number;
  onConfirm: () => void;
  isLoading?: boolean;
}

export default function WorldUnlockSheet({
  visible,
  onClose,
  nextWorld,
  totalCetis,
  onConfirm,
  isLoading = false,
}: WorldUnlockSheetProps) {
  const colors = useThemeColors();

  // Caso: no hay siguiente mundo (último planeta)
  if (!nextWorld) {
    return (
      <CetiBottomSheet
        visible={visible}
        onClose={onClose}
        title="Eres maestro del cosmos"
        subtitle="Has alcanzado el nivel más alto. ¡Felicitaciones!"
        closeOnBackdropPress
      >
        <View style={styles.masterWrap}>
          <View style={[styles.masterIcon, { backgroundColor: colors.fill.goldSubtle }]}>
            <Ionicons name="trophy" size={44} color={colors.gold.primary} />
          </View>
          <Text style={[styles.masterText, { color: colors.text.secondary }]}>
            Tu Metrópolis Ceti es el hogar definitivo.{'\n'}
            Sigue aprendiendo y acumulando Cetis.
          </Text>
          <CetiButton
            label="Continuar"
            onPress={onClose}
            variant="primary"
            size="large"
            style={styles.cta}
          />
        </View>
      </CetiBottomSheet>
    );
  }

  const canAfford = totalCetis >= nextWorld.costCetis;
  const missing = nextWorld.costCetis - totalCetis;

  return (
    <CetiBottomSheet
      visible={visible}
      onClose={onClose}
      title="Viajar al siguiente planeta"
      subtitle={nextWorld.subtitle}
      closeOnBackdropPress={!isLoading}
    >
      {/* Preview del mundo con Ionicon en lugar de emoji */}
      <View style={[styles.previewCard, { backgroundColor: colors.background.secondary }]}>
        <View style={[styles.previewIconWrap, { backgroundColor: colors.background.tertiary }]}>
          <Ionicons name={nextWorld.icon} size={38} color={colors.brand.primary} />
        </View>
        <View style={styles.previewText}>
          <Text style={[styles.worldName, { color: colors.text.primary }]}>{nextWorld.name}</Text>
          <Text style={[styles.worldSub, { color: colors.text.secondary }]}>
            {nextWorld.subtitle}
          </Text>
        </View>
      </View>

      {/* Costo */}
      <View style={[styles.costRow, { backgroundColor: colors.background.tertiary }]}>
        <View style={styles.costLeft}>
          <Ionicons name="sparkles" size={16} color={colors.gold.primary} />
          <Text style={[styles.costLabel, { color: colors.text.secondary }]}>Costo del viaje</Text>
        </View>
        <Text style={[styles.costValue, { color: colors.gold.primary }]}>
          {nextWorld.costCetis.toLocaleString()} Cetis
        </Text>
      </View>

      {/* Saldo */}
      <View style={[styles.costRow, { backgroundColor: colors.background.tertiary }]}>
        <View style={styles.costLeft}>
          <Ionicons name="wallet-outline" size={16} color={colors.text.tertiary} />
          <Text style={[styles.costLabel, { color: colors.text.secondary }]}>Tus Cetis</Text>
        </View>
        <Text
          style={[styles.costValue, { color: canAfford ? colors.system.green : colors.system.red }]}
        >
          {totalCetis.toLocaleString()} Cetis
        </Text>
      </View>

      {/* Aviso si no alcanza */}
      {!canAfford && (
        <View style={[styles.hintBox, { backgroundColor: colors.fill.redSubtle }]}>
          <Ionicons name="lock-closed-outline" size={15} color={colors.system.red} />
          <Text style={[styles.hintText, { color: colors.system.red }]}>
            Te faltan {missing.toLocaleString()} Cetis. ¡Aprende y ahorra para viajar!
          </Text>
        </View>
      )}

      {/* CTA */}
      <CetiButton
        label={canAfford ? `Viajar a ${nextWorld.name}` : 'Aun no tengo suficiente'}
        onPress={canAfford ? onConfirm : onClose}
        variant={canAfford ? 'primary' : 'secondary'}
        size="large"
        style={styles.cta}
        disabled={isLoading || !canAfford}
      />
    </CetiBottomSheet>
  );
}

const styles = StyleSheet.create({
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  previewIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewText: { flex: 1, gap: 4 },
  worldName: { ...Typography.title3, fontWeight: '800' },
  worldSub: { ...Typography.subheadline, lineHeight: 18 },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  costLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  costLabel: { ...Typography.subheadline, fontWeight: '600' },
  costValue: { ...Typography.subheadline, fontWeight: '800' },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  hintText: { ...Typography.footnote, flex: 1, lineHeight: 18 },
  cta: { width: '100%', marginTop: Spacing.xs },
  masterWrap: { alignItems: 'center', gap: Spacing.md, paddingBottom: Spacing.sm },
  masterIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  masterText: { ...Typography.body, textAlign: 'center', lineHeight: 22 },
});
