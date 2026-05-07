import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@shared/constants/typography';
import { useWalletStore, Transaction } from '@features/savings/store/useWalletStore';
import ChildUnitScreenLayout from '@shared/components/child/ChildUnitScreenLayout';
import type { ThemeColors } from '@shared/constants/colors';
import { useThemeColors } from '@shared/hooks/useThemeColors';

function SavingRocket({ progress }: { progress: number }) {
  const colors = useThemeColors();
  const rocketStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withRepeat(
          withSequence(withTiming(-5, { duration: 520 }), withTiming(0, { duration: 520 })),
          -1,
          true
        ),
      },
    ],
  }));

  return (
    <View style={rocketStyles.container}>
      <Animated.View style={[rocketStyles.rocket, rocketStyle]}>
        <Ionicons name="rocket" size={36} color={colors.gold.primary} />
      </Animated.View>
      <View style={[rocketStyles.path, { backgroundColor: colors.materials.highlight }]}>
        <View
          style={[
            rocketStyles.fill,
            { height: `${progress}%` as const, backgroundColor: colors.gold.primary },
          ]}
        />
      </View>
      <Text style={[rocketStyles.label, { color: colors.text.tertiary }]}>Meta</Text>
    </View>
  );
}

function TransactionItem({ tx }: { tx: Transaction }) {
  const colors = useThemeColors();
  const isIncome = tx.type !== 'spent';
  const color = isIncome ? colors.system.green : colors.system.red;

  return (
    <View style={act.item}>
      <View
        style={[
          act.iconWrap,
          { backgroundColor: isIncome ? colors.fill.greenSubtle : colors.fill.redSubtle },
        ]}
      >
        <Ionicons name={isIncome ? 'add' : 'remove'} size={20} color={color} />
      </View>
      <View style={act.info}>
        <Text style={[act.title, { color: colors.text.primary }]}>{tx.description}</Text>
        <Text style={[act.sub, { color: colors.text.tertiary }]}>Reciente</Text>
      </View>
      <Text style={[act.amount, { color: isIncome ? colors.system.green : colors.text.primary }]}>
        {isIncome ? '+' : '-'}
        {tx.amount}
      </Text>
    </View>
  );
}

export default function WalletScreen() {
  const { totalCetis, savedCetis, transactions } = useWalletStore();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <ChildUnitScreenLayout
      kicker="Ahorros"
      title="Mi alcancía"
      subtitle="Cetis para jugar y tu cohete hacia la meta"
      chip={String(totalCetis)}
    >
      <Animated.View
        entering={motion.enterDown(40)}
        style={[
          styles.heroCard,
          { backgroundColor: colors.background.elevated, borderColor: colors.materials.border },
        ]}
      >
        <Text style={[styles.heroLabel, { color: colors.text.tertiary }]}>Cetis para gastar</Text>
        <View style={styles.heroRow}>
          <Text style={[styles.heroNumber, { color: colors.text.primary }]}>{totalCetis}</Text>
          <Ionicons name="sparkles" size={28} color={colors.gold.primary} />
        </View>
      </Animated.View>

      <Animated.View
        entering={motion.enterDown(72)}
        style={[
          styles.panel,
          { backgroundColor: colors.background.elevated, borderColor: colors.materials.border },
        ]}
      >
        <View style={styles.panelText}>
          <Text style={[styles.panelTitle, { color: colors.text.primary }]}>Tu alcancía</Text>
          <Text style={[styles.panelValue, { color: colors.gold.primary }]}>
            {savedCetis} Cetis
          </Text>
          <Text style={[styles.panelSub, { color: colors.text.tertiary }]}>
            Guardados para metas
          </Text>
        </View>
        <SavingRocket progress={Math.min((savedCetis / 100) * 100, 100)} />
      </Animated.View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.brand.primary }]}
          activeOpacity={0.85}
        >
          <Text style={[styles.actionBtnText, { color: colors.text.onBrand }]}>Ahorrar</Text>
          <Ionicons name="archive" size={20} color={colors.text.onBrand} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            {
              backgroundColor: colors.materials.highlight,
              borderWidth: 1,
              borderColor: colors.materials.border,
            },
          ]}
          activeOpacity={0.85}
        >
          <Text style={[styles.actionBtnText, { color: colors.text.primary }]}>Gastar</Text>
          <Ionicons name="cart" size={20} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <Animated.View entering={motion.enterDown(104)} style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Movimientos</Text>
        <View
          style={[
            styles.listCard,
            { backgroundColor: colors.background.elevated, borderColor: colors.materials.border },
          ]}
        >
          {transactions.slice(0, 6).map((tx) => (
            <TransactionItem key={tx.id} tx={tx} />
          ))}
        </View>
      </Animated.View>
    </ChildUnitScreenLayout>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    heroCard: {
      borderRadius: 22,
      paddingVertical: 24,
      paddingHorizontal: 20,
      alignItems: 'center',
      borderWidth: 1,
      marginBottom: 14,
    },
    heroLabel: { ...Typography.caption1, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6 },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    heroNumber: { fontSize: 48, fontWeight: '900', letterSpacing: -1 },

    panel: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 22,
      padding: 20,
      borderWidth: 1,
      marginBottom: 16,
    },
    panelText: { flex: 1, gap: 4 },
    panelTitle: { ...Typography.headline, fontWeight: '800' },
    panelValue: { ...Typography.title2, fontWeight: '900' },
    panelSub: { ...Typography.caption1 },

    actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 22 },
    actionBtn: {
      flex: 1,
      height: 56,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    actionBtnText: { ...Typography.headline, fontWeight: '800', fontSize: 15 },

    section: { gap: 10, marginBottom: 24 },
    sectionTitle: { ...Typography.title3, fontWeight: '800' },
    listCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  });

const rocketStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: 6 },
  rocket: { zIndex: 2 },
  path: { width: 10, height: 72, borderRadius: 5, justifyContent: 'flex-end', overflow: 'hidden' },
  fill: { width: '100%', borderRadius: 5 },
  label: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
});

const act = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1, gap: 2 },
  title: { ...Typography.headline, fontSize: 15 },
  sub: { ...Typography.caption2 },
  amount: { ...Typography.title3, fontWeight: '800' },
});
