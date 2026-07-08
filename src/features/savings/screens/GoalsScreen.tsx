import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { motion } from '@shared/constants/motion';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@shared/constants/typography';
import { Spacing } from '@shared/constants/theme';
import {
  useSavingsStore,
  type SavingsGoal,
  type GoalCategory,
} from '@features/savings/store/useSavingsStore';
import {
  LIFE_PROJECT_TEMPLATES,
  monthsToReach,
  suggestMonthly,
} from '@features/savings/data/lifeProjects';
import { useUserStore } from '@features/auth/store/useUserStore';
import CetiButton from '@shared/components/CetiButton';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import { formatMoneyInputThousands, parseMoneyAmountInt } from '@shared/utils/moneyInputFormat';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import { showCetiNotice } from '@shared/store/useCetiOverlayStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function VisualGoalCard({
  goal,
  delay,
  onDeposit,
}: {
  goal: SavingsGoal;
  delay: number;
  onDeposit: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const progress =
    goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;

  return (
    <Animated.View
      entering={motion.enterDown(delay)}
      style={[
        styles.goalCard,
        { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.goalName, { color: colors.text.primary }]}>{goal.title}</Text>
          <Text style={[styles.goalStatus, { color: colors.text.tertiary }]}>
            {progress === 100 ? t('goals.goalReached') : t('goals.yourGoal')}
          </Text>
        </View>
        {progress === 100 ? (
          <Ionicons name="trophy" size={24} color={colors.gold.primary} />
        ) : (
          <TouchableOpacity
            style={[styles.cardDepositBtn, { backgroundColor: colors.brand.primary }]}
            onPress={onDeposit}
            accessibilityRole="button"
            accessibilityLabel={t('goals.depositForGoal', { title: goal.title })}
          >
            <Ionicons name="add-circle" size={18} color={colors.text.onBrand} />
            <Text style={[styles.cardDepositText, { color: colors.text.onBrand }]}>
              {t('goals.save')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.progressArea}>
        <View style={styles.barContainer}>
          <View style={[styles.barBg, { backgroundColor: colors.materials.highlight }]}>
            <View
              style={[
                styles.barFill,
                { width: `${progress}%` as any, backgroundColor: colors.brand.primary },
              ]}
            />
          </View>
          {progress > 0 && progress < 100 && (
            <Animated.View
              style={[
                styles.progressIndicator,
                {
                  left: `${progress}%` as any,
                  backgroundColor: colors.brand.primary,
                  borderColor: colors.background.base,
                },
              ]}
            />
          )}
        </View>
        <View style={styles.amountRow}>
          <Text style={[styles.currentAmount, { color: colors.text.primary }]}>
            {formatDisplayCopGoals(goal.currentAmount)}
          </Text>
          <Text style={[styles.targetAmount, { color: colors.text.tertiary }]}>
            {t('goals.ofTarget', { amount: formatDisplayCopGoals(goal.targetAmount) })}
          </Text>
        </View>
        {progress < 100 &&
          (() => {
            const monthly = suggestMonthly(goal.targetAmount, goal.currentAmount);
            const months = monthsToReach(goal.targetAmount, goal.currentAmount, monthly);
            return monthly > 0 && months != null ? (
              <Text style={[styles.projection, { color: colors.text.tertiary }]}>
                {t('goals.projection', {
                  monthly: formatDisplayCopGoals(monthly),
                  months,
                })}
              </Text>
            ) : null;
          })()}
      </View>
    </Animated.View>
  );
}

export default function GoalsScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { totalCetis } = useWalletStore();
  const { nickname } = useUserStore();
  const [showNewGoal, setShowNewGoal] = useState(false);

  const goals = useSavingsStore((s) => s.goals);
  const deposits = useSavingsStore((s) => s.deposits);
  const totalSaved = useSavingsStore((s) => s.getTotalSaved)();

  // RQ-ES10 (D-ES10-03): el registro es SOLO por voz — "Ahorrar" navega al
  // diario de movimientos (con la meta preseleccionada si venía de una tarjeta).
  const openDeposit = (goal?: SavingsGoal) => {
    router.push(
      goal ? { pathname: '/(app)/movimientos', params: { goalId: goal.id } } : '/(app)/movimientos'
    );
  };

  return (
    <>
      <ScreenWrapper style={[stylesD.root, { backgroundColor: colors.background.base }]}>
        <ScrollView
          contentContainerStyle={[
            stylesD.scroll,
            { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 8) + 16 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[stylesD.pageTitle, { color: colors.text.primary }]}>
            {t('goals.pageTitle')}
          </Text>
          <Text style={[stylesD.pageSubtitle, { color: colors.text.secondary }]}>
            {t('goals.pageSubtitle', { name: nickname })}
          </Text>

          <View style={stylesD.economyRow}>
            <Animated.View
              entering={motion.enterDown(72)}
              style={[
                stylesD.economyCard,
                { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
              ]}
            >
              <View style={stylesD.economyCardInner}>
                <View
                  style={[stylesD.economyIconWrap, { backgroundColor: colors.materials.highlight }]}
                >
                  <Ionicons name="wallet-outline" size={22} color={colors.gold.primary} />
                </View>
                <View style={stylesD.economyTexts}>
                  <Text style={[stylesD.economyLabel, { color: colors.text.tertiary }]}>
                    {t('goals.savings')}
                  </Text>
                  <Text
                    style={[stylesD.economyValue, { color: colors.gold.primary }]}
                    numberOfLines={1}
                  >
                    {formatDisplayCopGoals(totalSaved)}
                  </Text>
                </View>
              </View>
            </Animated.View>

            <Animated.View
              entering={motion.enterDown(104)}
              style={[
                stylesD.economyCard,
                { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
              ]}
            >
              <View style={stylesD.economyCardInner}>
                <View
                  style={[stylesD.economyIconWrap, { backgroundColor: colors.materials.highlight }]}
                >
                  <Ionicons name="sparkles" size={22} color={colors.brand.primary} />
                </View>
                <View style={stylesD.economyTexts}>
                  <Text style={[stylesD.economyLabel, { color: colors.text.tertiary }]}>
                    {t('goals.cetis')}
                  </Text>
                  <Text style={[stylesD.economyValue, { color: colors.text.primary }]}>
                    {totalCetis}
                  </Text>
                </View>
              </View>
            </Animated.View>
          </View>

          <View style={stylesD.actionsRow}>
            <TouchableOpacity
              style={[stylesD.actionBtn, { backgroundColor: colors.brand.primary }]}
              onPress={() => openDeposit()}
              accessibilityRole="button"
              accessibilityLabel={t('goals.save')}
            >
              <Ionicons name="add-circle" size={20} color={colors.text.onBrand} />
              <Text style={[stylesD.actionBtnText, { color: colors.text.onBrand }]}>
                {t('goals.save')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                stylesD.actionBtn,
                {
                  backgroundColor: colors.background.secondary,
                  borderColor: colors.materials.border,
                  borderWidth: 1,
                },
              ]}
              onPress={() => setShowNewGoal(true)}
              accessibilityRole="button"
              accessibilityLabel={t('goals.newGoal')}
            >
              <Ionicons name="flag" size={18} color={colors.text.primary} />
              <Text style={[stylesD.actionBtnText, { color: colors.text.primary }]}>
                {t('goals.newGoal')}
              </Text>
            </TouchableOpacity>
          </View>

          <Animated.View entering={motion.enterDown(128)} style={stylesD.section}>
            <Text style={[stylesD.sectionTitle, { color: colors.text.primary }]}>
              {t('goals.yourGoals')}
            </Text>
            {goals.length > 0 ? (
              goals.map((g, i) => (
                <VisualGoalCard
                  key={g.id}
                  goal={g}
                  delay={96 + i * 40}
                  onDeposit={() => openDeposit(g)}
                />
              ))
            ) : (
              <View
                style={[
                  stylesD.emptyCard,
                  { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
                ]}
              >
                <Ionicons name="star-outline" size={40} color={colors.separator.opaque} />
                <Text style={[stylesD.emptyText, { color: colors.text.tertiary }]}>
                  {t('goals.firstGoal')}
                </Text>
                <CetiButton
                  label={t('goals.createMyGoal')}
                  onPress={() => setShowNewGoal(true)}
                  variant="glass"
                  size="small"
                />
              </View>
            )}
          </Animated.View>

          <Animated.View
            entering={motion.enterDown(168)}
            style={[stylesD.section, { marginTop: 14 }]}
          >
            <Text style={[stylesD.sectionTitle, { color: colors.text.primary }]}>
              {t('goals.history')}
            </Text>
            <View
              style={[
                stylesD.historyBox,
                { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
              ]}
            >
              {deposits.length === 0 ? (
                <View style={stylesD.historyEmpty}>
                  <Text style={[stylesD.emptyText, { color: colors.text.tertiary }]}>
                    {t('goals.noDeposits')}
                  </Text>
                </View>
              ) : (
                deposits.slice(0, 5).map((d, i, arr) => (
                  <View
                    key={d.id}
                    style={[
                      stylesD.historyItem,
                      i < arr.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.materials.border,
                      },
                    ]}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={colors.system.green} />
                    <Text style={[stylesD.historyDesc, { color: colors.text.primary }]}>
                      {d.description}
                    </Text>
                    <Text
                      style={[stylesD.historyAmt, { color: colors.text.secondary }]}
                      numberOfLines={1}
                    >
                      {formatDisplayCopGoals(d.amount)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </Animated.View>
        </ScrollView>
      </ScreenWrapper>

      <NewGoalModal visible={showNewGoal} onClose={() => setShowNewGoal(false)} colors={colors} />
    </>
  );
}

function NewGoalModal({
  visible,
  onClose,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [category, setCategory] = useState<GoalCategory>('custom');
  const addGoal = useSavingsStore((s) => s.addGoal);

  const reset = () => {
    setTitle('');
    setTarget('');
    setEmoji('🎯');
    setCategory('custom');
  };

  const handleCreate = () => {
    const num = parseMoneyAmountInt(target);
    if (!title.trim() || !num) {
      showCetiNotice({
        variant: 'error',
        title: t('goals.missingDataTitle'),
        message: t('goals.missingDataMsg'),
      });
      return;
    }
    addGoal({
      title: title.trim(),
      targetAmount: num,
      category,
      emoji,
      description: '',
      frequency: 'total',
    });
    showCetiNotice({
      variant: 'success',
      title: t('goals.goalCreatedTitle'),
      message: t('goals.goalCreatedMsg'),
    });
    reset();
    onClose();
  };

  return (
    <CetiBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('goals.newGoalTitle')}
      subtitle={t('goals.newGoalSub')}
      closeOnBackdropPress
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View>
          <Text style={{ color: colors.text.secondary, fontWeight: '700', marginBottom: 8 }}>
            {t('goals.templatesLabel')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {LIFE_PROJECT_TEMPLATES.map((tpl) => (
              <TouchableOpacity
                key={tpl.id}
                onPress={() => {
                  setTitle(t(tpl.titleKey));
                  setTarget(formatMoneyInputThousands(String(tpl.suggestedTarget)));
                  setEmoji(tpl.emoji);
                  setCategory(tpl.category);
                }}
                accessibilityRole="button"
                accessibilityLabel={t(tpl.titleKey)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: colors.materials.highlight,
                  borderColor: colors.materials.border,
                  borderWidth: 1,
                  borderRadius: 999,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                }}
              >
                <Text>{tpl.emoji}</Text>
                <Text style={{ color: colors.text.primary, fontWeight: '600', fontSize: 13 }}>
                  {t(tpl.titleKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[
              mStyles.input,
              {
                backgroundColor: colors.materials.highlight,
                color: colors.text.primary,
                borderColor: colors.materials.border,
              },
            ]}
            placeholder={t('goals.goalNamePlaceholder')}
            placeholderTextColor={colors.text.tertiary}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[
              mStyles.input,
              {
                backgroundColor: colors.materials.highlight,
                color: colors.text.primary,
                borderColor: colors.materials.border,
              },
            ]}
            placeholder={t('goals.goalCostPlaceholder')}
            placeholderTextColor={colors.text.tertiary}
            keyboardType="numeric"
            value={target}
            onChangeText={(text) => setTarget(formatMoneyInputThousands(text))}
          />
          <View style={mStyles.row}>
            <CetiButton
              label={t('goals.cancel')}
              onPress={onClose}
              variant="glass"
              size="medium"
              style={{ flex: 1 }}
            />
            <CetiButton
              label={t('goals.createGoal')}
              onPress={handleCreate}
              variant="primary"
              size="medium"
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </CetiBottomSheet>
  );
}

const stylesD = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.base, paddingBottom: 120, gap: 22 },
  pageTitle: { ...Typography.largeTitle, fontWeight: '900' },
  pageSubtitle: { ...Typography.subheadline, marginTop: 4 },

  economyRow: { flexDirection: 'row', gap: 12 },
  economyCard: { flex: 1, borderRadius: 20, borderWidth: 1, overflow: 'hidden', minHeight: 80 },
  economyCardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  economyIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  economyTexts: { flex: 1, minWidth: 0, gap: 4 },
  economyLabel: {
    ...Typography.caption2,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  economyValue: { ...Typography.headline, fontWeight: '900', fontSize: 17 },

  actionsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: { ...Typography.subheadline, fontWeight: '800' },

  section: { gap: 18 },
  sectionTitle: { ...Typography.title3, fontWeight: '800' },

  emptyCard: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
    borderRadius: 32,
    borderStyle: 'dashed',
    borderWidth: 2,
  },
  emptyText: { ...Typography.subheadline, textAlign: 'center' },

  historyBox: { borderRadius: 20, paddingHorizontal: 4, paddingVertical: 4, borderWidth: 1 },
  historyEmpty: { paddingVertical: 20, alignItems: 'center' },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  historyDesc: { flex: 1, ...Typography.caption1 },
  historyAmt: { ...Typography.headline, fontWeight: '700', flexShrink: 0, marginLeft: 8 },
});

const styles = StyleSheet.create({
  goalCard: {
    borderRadius: 28,
    paddingVertical: 22,
    paddingHorizontal: 20,
    gap: 22,
    borderWidth: 1,
    marginBottom: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  goalName: { ...Typography.headline, fontWeight: '800' },
  goalStatus: { ...Typography.caption1 },
  cardDepositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    flexShrink: 0,
    marginTop: 2,
  },
  cardDepositText: { ...Typography.caption1, fontWeight: '800' },
  progressArea: { gap: 14, marginTop: 2 },
  barContainer: { height: 12, borderRadius: 6, justifyContent: 'center' },
  barBg: { ...StyleSheet.absoluteFillObject, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  progressIndicator: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    marginLeft: -8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  currentAmount: { ...Typography.headline, fontWeight: '800' },
  targetAmount: { ...Typography.caption1 },
  projection: { ...Typography.caption2, marginTop: 8, fontStyle: 'italic' },
});

const mStyles = StyleSheet.create({
  input: { borderRadius: 20, padding: 20, ...Typography.body, borderWidth: 1, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
});
