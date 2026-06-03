import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { motion } from '@shared/constants/motion';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@shared/constants/typography';
import { Spacing } from '@shared/constants/theme';
import { useWalletStore, Transaction } from '@features/savings/store/useWalletStore';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import type { ThemeColors } from '@shared/constants/colors';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function SavingRocket({ progress }: { progress: number }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
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
      <Text style={[rocketStyles.label, { color: colors.text.tertiary }]}>
        {t('savings.goalShort')}
      </Text>
    </View>
  );
}

function TransactionItem({ tx }: { tx: Transaction }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
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
        <Text style={[act.sub, { color: colors.text.tertiary }]}>{t('savings.recent')}</Text>
      </View>
      <Text style={[act.amount, { color: isIncome ? colors.system.green : colors.text.primary }]}>
        {isIncome ? '+' : '-'}
        {tx.amount}
      </Text>
    </View>
  );
}

type ModalMode = 'save' | 'withdraw' | null;

export default function WalletScreen() {
  const { totalCetis, savedCetis, transactions, saveCetis, withdrawSavings } = useWalletStore();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = getStyles(colors);

  const [mode, setMode] = useState<ModalMode>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const closeModal = () => {
    setMode(null);
    setAmount('');
    setError('');
  };

  const onConfirm = () => {
    const value = Math.floor(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('savings.invalidAmount'));
      return;
    }
    if (mode === 'save') {
      if (!saveCetis(value)) {
        setError(t('savings.insufficient'));
        return;
      }
    } else if (mode === 'withdraw') {
      if (!withdrawSavings(value)) {
        setError(t('savings.insufficientSaved'));
        return;
      }
    }
    closeModal();
  };

  const modalTitle = mode === 'withdraw' ? t('savings.withdrawTitle') : t('savings.saveTitle');
  const modalAvailable =
    mode === 'withdraw'
      ? t('savings.availableSaved', { n: savedCetis })
      : t('savings.available', { n: totalCetis });

  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 8) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: colors.text.primary }]}>
          {t('savings.walletTitle')}
        </Text>
        <Text style={[styles.pageSubtitle, { color: colors.text.secondary }]}>
          {t('savings.walletSubtitle')}
        </Text>

        <Animated.View
          entering={motion.enterDown(40)}
          style={[
            styles.heroCard,
            { backgroundColor: colors.background.elevated, borderColor: colors.materials.border },
          ]}
        >
          <Text style={[styles.heroLabel, { color: colors.text.tertiary }]}>
            {t('savings.spendable')}
          </Text>
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
            <Text style={[styles.panelTitle, { color: colors.text.primary }]}>
              {t('savings.piggyTitle')}
            </Text>
            <Text style={[styles.panelValue, { color: colors.gold.primary }]}>
              {t('savings.savedAmount', { n: savedCetis })}
            </Text>
            <Text style={[styles.panelSub, { color: colors.text.tertiary }]}>
              {t('savings.savedForGoals')}
            </Text>
          </View>
          <SavingRocket progress={Math.min((savedCetis / 100) * 100, 100)} />
        </Animated.View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.brand.primary }]}
            activeOpacity={0.85}
            onPress={() => {
              setError('');
              setAmount('');
              setMode('save');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('savings.save')}
          >
            <Text style={[styles.actionBtnText, { color: colors.text.onBrand }]}>
              {t('savings.save')}
            </Text>
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
            onPress={() => {
              setError('');
              setAmount('');
              setMode('withdraw');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('savings.withdraw')}
          >
            <Text style={[styles.actionBtnText, { color: colors.text.primary }]}>
              {t('savings.withdraw')}
            </Text>
            <Ionicons name="cart" size={20} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <Animated.View entering={motion.enterDown(104)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            {t('savings.movements')}
          </Text>
          <View
            style={[
              styles.listCard,
              { backgroundColor: colors.background.elevated, borderColor: colors.materials.border },
            ]}
          >
            {transactions.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.text.tertiary }]}>
                {t('savings.noMovements')}
              </Text>
            ) : (
              transactions.slice(0, 6).map((tx) => <TransactionItem key={tx.id} tx={tx} />)
            )}
          </View>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={mode !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
        statusBarTranslucent
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay.modalBackdrop }]}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.background.elevated, borderColor: colors.materials.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text.primary }]}>{modalTitle}</Text>
            <Text style={[styles.modalAvailable, { color: colors.text.tertiary }]}>
              {modalAvailable}
            </Text>
            <TextInput
              value={amount}
              onChangeText={(v) => {
                setAmount(v.replace(/[^0-9]/g, ''));
                if (error) setError('');
              }}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder={t('savings.amountPlaceholder')}
              placeholderTextColor={colors.text.tertiary}
              style={[
                styles.modalInput,
                {
                  color: colors.text.primary,
                  borderColor: error ? colors.system.red : colors.materials.border,
                  backgroundColor: colors.background.base,
                },
              ]}
              accessibilityLabel={t('savings.amountPlaceholder')}
              autoFocus
            />
            {error ? (
              <Text style={[styles.modalError, { color: colors.system.red }]}>{error}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.materials.highlight }]}
                onPress={closeModal}
                accessibilityRole="button"
                accessibilityLabel={t('savings.cancel')}
              >
                <Text style={[styles.modalBtnText, { color: colors.text.primary }]}>
                  {t('savings.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.brand.primary }]}
                onPress={onConfirm}
                accessibilityRole="button"
                accessibilityLabel={t('savings.confirm')}
              >
                <Text style={[styles.modalBtnText, { color: colors.text.onBrand }]}>
                  {t('savings.confirm')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background.base },
    scroll: { paddingHorizontal: Spacing.base, paddingBottom: 120, gap: 16 },
    pageTitle: { ...Typography.largeTitle, fontWeight: '900' },
    pageSubtitle: { ...Typography.subheadline, marginTop: 4 },

    heroCard: {
      borderRadius: 22,
      paddingVertical: 24,
      paddingHorizontal: 20,
      alignItems: 'center',
      borderWidth: 1,
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
    },
    panelText: { flex: 1, gap: 4 },
    panelTitle: { ...Typography.headline, fontWeight: '800' },
    panelValue: { ...Typography.title2, fontWeight: '900' },
    panelSub: { ...Typography.caption1 },

    actionsRow: { flexDirection: 'row', gap: 12 },
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

    section: { gap: 10 },
    sectionTitle: { ...Typography.title3, fontWeight: '800' },
    listCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
    emptyText: { ...Typography.subheadline, padding: 20, textAlign: 'center' },

    modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 22,
      borderWidth: 1,
      padding: 22,
      gap: 12,
    },
    modalTitle: { ...Typography.title3, fontWeight: '800' },
    modalAvailable: { ...Typography.subheadline },
    modalInput: {
      height: 52,
      borderRadius: 14,
      borderWidth: 1,
      paddingHorizontal: 16,
      fontSize: 20,
      fontWeight: '800',
    },
    modalError: { ...Typography.caption1, fontWeight: '700' },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
    modalBtn: {
      flex: 1,
      height: 50,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBtnText: { ...Typography.headline, fontWeight: '800', fontSize: 15 },
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
