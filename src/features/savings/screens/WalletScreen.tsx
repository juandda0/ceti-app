import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@shared/constants/typography';
import { useWalletStore, Transaction } from '@features/savings/store/useWalletStore';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';

// ── Visual de Ahorro Dinámico (Cohete) ───────────────────────────────────────
function SavingRocket({ progress }: { progress: number }) {
  const colors = useThemeColors();
  const rocketStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withRepeat(withSequence(withTiming(-5, { duration: 1000 }), withTiming(0, { duration: 1000 })), -1, true) }]
  }));

  return (
    <View style={rocketStyles.container}>
      <Animated.View style={[rocketStyles.rocket, rocketStyle]}>
        <Ionicons name="rocket" size={40} color={colors.gold.primary} />
      </Animated.View>
      <View style={[rocketStyles.path, { backgroundColor: colors.separator.transparent }]}>
        <View style={[rocketStyles.fill, { height: `${progress}%` as any, backgroundColor: colors.gold.primary }]} />
      </View>
      <Text style={[rocketStyles.label, { color: colors.text.tertiary }]}>Rumbo a tu meta</Text>
    </View>
  );
}

// ── Item de Movimiento Simple ────────────────────────────────────────────────
function TransactionItem({ tx }: { tx: Transaction }) {
  const colors = useThemeColors();
  const isIncome = tx.type !== 'spent';
  const color = isIncome ? colors.system.green : colors.system.red;
  
  return (
    <View style={act.item}>
      <View style={[act.iconWrap, { backgroundColor: color + '15' }]}>
        <Ionicons name={isIncome ? 'add' : 'remove'} size={20} color={color} />
      </View>
      <View style={act.info}>
        <Text style={[act.title, { color: colors.text.primary }]}>{tx.description}</Text>
        <Text style={[act.sub, { color: colors.text.tertiary }]}>Hace un momento</Text>
      </View>
      <Text style={[act.amount, { color: isIncome ? colors.system.green : colors.text.primary }]}>
        {isIncome ? '+' : '-'}{tx.amount}
      </Text>
    </View>
  );
}

export default function WalletScreen() {
  const { totalCetis, savedCetis, transactions } = useWalletStore();
  const colors = useThemeColors();
  const mode = useThemeStore(s => s.mode);
  const styles = getStyles(colors, mode);

  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Header Amigable */}
        <View style={styles.header}>
          <PageHeader 
            overline="Tesoro"
            title="Mi alcancía"
            subtitle="¡Mira cuánto has ganado!"
            style={{ flex: 1 }}
          />
        </View>

        {/* Balance Gigante y Claro */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Cetis para gastar</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceText}>{totalCetis}</Text>
            <Ionicons name="sparkles" size={24} color={colors.gold.primary} />
          </View>
        </Animated.View>

        {/* Visual de Ahorro (Reemplaza los gráficos complejos) */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.rocketSection}>
          <View style={styles.rocketInfo}>
            <Text style={styles.rocketTitle}>Tu Alcancía</Text>
            <Text style={styles.rocketValue}>{savedCetis} Cetis</Text>
            <Text style={styles.rocketSub}>Ahorrados para tus metas</Text>
          </View>
          <SavingRocket progress={Math.min((savedCetis / 100) * 100, 100)} />
        </Animated.View>

        {/* Acciones Grandes y Dinámicas */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.brand.primary }]}>
            <Text style={[styles.actionBtnText, { color: colors.text.onBrand }]}>Ahorrar</Text>
            <Ionicons name="archive" size={20} color={colors.text.onBrand} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.materials.highlight }]}>
            <Text style={[styles.actionBtnText, { color: colors.text.primary }]}>Gastar</Text>
            <Ionicons name="cart" size={20} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Movimientos Recientes */}
        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Últimos movimientos</Text>
          <View style={styles.activityList}>
            {transactions.slice(0, 4).map(tx => (
              <TransactionItem key={tx.id} tx={tx} />
            ))}
          </View>
        </Animated.View>

      </ScrollView>
    </ScreenWrapper>
  );
}

const getStyles = (colors: any, mode: string) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.base },
  scroll: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 120, gap: 24 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  balanceCard: { 
    backgroundColor: colors.brand.primary + (mode === 'light' ? '15' : '10'), 
    borderRadius: 32, 
    padding: 32, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: colors.brand.primary + '30' 
  },
  balanceLabel: { ...Typography.headline, color: colors.brand.primary, marginBottom: 8 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  balanceText: { ...Typography.displayNumberLarge, color: colors.text.primary, fontSize: 64, fontWeight: '900' },

  rocketSection: { 
    flexDirection: 'row', 
    backgroundColor: colors.materials.base, 
    borderRadius: 32, 
    padding: 24, 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    borderWidth: 1, 
    borderColor: colors.materials.border 
  },
  rocketInfo: { flex: 1, gap: 4 },
  rocketTitle: { ...Typography.headline, color: colors.text.primary, fontWeight: '700' },
  rocketValue: { ...Typography.title1, color: colors.gold.primary, fontWeight: '800' },
  rocketSub: { ...Typography.caption1, color: colors.text.tertiary },

  actionsRow: { flexDirection: 'row', gap: 16 },
  actionBtn: { flex: 1, height: 64, borderRadius: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  actionBtnText: { ...Typography.headline, fontWeight: '800' },

  section: { gap: 16 },
  sectionTitle: { ...Typography.title3, color: colors.text.primary, fontWeight: '700' },
  activityList: { backgroundColor: colors.materials.base, borderRadius: 24, padding: 8, borderWidth: 1, borderColor: colors.materials.border },
});

const rocketStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8 },
  rocket: { zIndex: 2 },
  path: { width: 12, height: 80, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  fill: { width: '100%', borderRadius: 6 },
  label: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
});

const act = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, gap: 2 },
  title: { ...Typography.headline, fontSize: 16 },
  sub: { ...Typography.caption2 },
  amount: { ...Typography.title3, fontWeight: '800' },
});
