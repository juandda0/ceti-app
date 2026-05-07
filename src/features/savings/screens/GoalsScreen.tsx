// app/(child)/goals.tsx — Metas Visuales y Dinámicas para Niños (Versión sin iconos y funcional)
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@shared/constants/typography';
import { useSavingsStore, SavingsGoal } from '@features/savings/store/useSavingsStore';
import { useChildStore } from '@features/auth/store/useChildStore';
import CetiButton from '@shared/components/CetiButton';
import ChildUnitScreenLayout from '@shared/components/child/ChildUnitScreenLayout';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import { formatMoneyInputThousands, parseMoneyAmountInt } from '@shared/utils/moneyInputFormat';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import { showCetiNotice } from '@shared/store/useCetiOverlayStore';

// ── Tarjeta de Meta Visual (Sin Iconos) ───────────────────────────────────────
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
            {progress === 100
              ? '¡Meta alcanzada!'
              : `${goal.source === 'parent' ? 'Reto de Papá' : 'Tu propia meta'}`}
          </Text>
        </View>
        {progress === 100 ? (
          <Ionicons name="trophy" size={24} color={colors.gold.primary} />
        ) : (
          <TouchableOpacity
            style={[
              styles.cardDepositBtn,
              { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
            ]}
            onPress={onDeposit}
          >
            <Ionicons name="add-circle" size={18} color={colors.text.onBrand} />
            <Text style={[styles.cardDepositText, { color: colors.text.onBrand }]}>¡Ahorrar!</Text>
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
            de {formatDisplayCopGoals(goal.targetAmount)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function GoalsScreen() {
  const colors = useThemeColors();
  const styles_dynamic = getStyles(colors);
  const { totalCetis } = useWalletStore();

  const { id: activeChildId, nickname } = useChildStore();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [preSelectedGoal, setPreSelectedGoal] = useState<{ id: string; title: string } | null>(
    null
  );

  const rawGoals = useSavingsStore((s) => s.goals);
  const rawDeposits = useSavingsStore((s) => s.deposits);

  const goals = rawGoals.filter((g) => g.childId === activeChildId);
  const deposits = rawDeposits.filter((d) => d.childId === activeChildId);
  const totalApproved = deposits
    .filter((d) => d.status === 'approved')
    .reduce((a, b) => a + b.amount, 0);

  const openDeposit = (goal?: SavingsGoal) => {
    if (goal) {
      setPreSelectedGoal({ id: goal.id, title: goal.title });
    } else {
      setPreSelectedGoal(null);
    }
    setShowDeposit(true);
  };

  return (
    <>
      <ChildUnitScreenLayout
        kicker="Metas"
        title="Tus metas"
        subtitle={`¡Hola ${nickname}! Ahorra para lo que sueñas.`}
        chip={goals.length > 0 ? String(goals.length) : undefined}
      >
        {/* Economía: mismas superficies que el resto de metas; acento en barra + icono */}
        <View style={styles_dynamic.economyRow}>
          <Animated.View
            entering={motion.enterDown(72)}
            style={[
              styles_dynamic.economyCard,
              { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
            ]}
          >
            <View style={styles_dynamic.economyCardInner}>
              <View
                style={[
                  styles_dynamic.economyIconWrap,
                  { backgroundColor: colors.materials.highlight },
                ]}
              >
                <Ionicons name="wallet-outline" size={22} color={colors.gold.primary} />
              </View>
              <View style={styles_dynamic.economyTexts}>
                <Text style={[styles_dynamic.economyLabel, { color: colors.text.tertiary }]}>
                  Ahorros
                </Text>
                <Text
                  style={[styles_dynamic.economyValue, { color: colors.gold.primary }]}
                  numberOfLines={1}
                >
                  {formatDisplayCopGoals(totalApproved)}
                </Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View
            entering={motion.enterDown(104)}
            style={[
              styles_dynamic.economyCard,
              { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
            ]}
          >
            <View style={styles_dynamic.economyCardInner}>
              <View
                style={[
                  styles_dynamic.economyIconWrap,
                  { backgroundColor: colors.materials.highlight },
                ]}
              >
                <Ionicons name="sparkles" size={22} color={colors.brand.primary} />
              </View>
              <View style={styles_dynamic.economyTexts}>
                <Text style={[styles_dynamic.economyLabel, { color: colors.text.tertiary }]}>
                  Cetis
                </Text>
                <Text style={[styles_dynamic.economyValue, { color: colors.text.primary }]}>
                  {totalCetis}
                </Text>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Botones de Acción */}
        <View style={styles_dynamic.actionsRow}>
          <TouchableOpacity
            style={[styles_dynamic.actionBtn, { backgroundColor: colors.brand.primary }]}
            onPress={() => openDeposit()}
          >
            <Ionicons name="add-circle" size={20} color={colors.text.onBrand} />
            <Text style={[styles_dynamic.actionBtnText, { color: colors.text.onBrand }]}>
              ¡Ahorrar!
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles_dynamic.actionBtn,
              {
                backgroundColor: colors.background.secondary,
                borderColor: colors.materials.border,
                borderWidth: 1,
              },
            ]}
            onPress={() => setShowNewGoal(true)}
          >
            <Ionicons name="flag" size={18} color={colors.text.primary} />
            <Text style={[styles_dynamic.actionBtnText, { color: colors.text.primary }]}>
              Nueva meta
            </Text>
          </TouchableOpacity>
        </View>

        {/* Metas Activas */}
        <Animated.View entering={motion.enterDown(128)} style={styles_dynamic.section}>
          <Text style={[styles_dynamic.sectionTitle, { color: colors.text.primary }]}>
            Tus Metas
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
                styles_dynamic.emptyCard,
                { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
              ]}
            >
              <Ionicons name="star-outline" size={40} color={colors.separator.opaque} />
              <Text style={[styles_dynamic.emptyText, { color: colors.text.tertiary }]}>
                ¿Cuál será tu primera meta?
              </Text>
              <CetiButton
                label="Crear mi meta"
                onPress={() => setShowNewGoal(true)}
                variant="glass"
                size="small"
              />
            </View>
          )}
        </Animated.View>

        {/* Historial de Ahorro Simplificado */}
        <Animated.View
          entering={motion.enterDown(168)}
          style={[styles_dynamic.section, { marginTop: 14 }]}
        >
          <Text style={[styles_dynamic.sectionTitle, { color: colors.text.primary }]}>
            Mis ahorros
          </Text>
          <View
            style={[
              styles_dynamic.historyBox,
              { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
            ]}
          >
            {deposits.slice(0, 3).map((d, i, arr) => (
              <View
                key={d.id}
                style={[
                  styles_dynamic.historyItem,
                  i < arr.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.materials.border,
                  },
                ]}
              >
                <Ionicons
                  name={d.status === 'approved' ? 'checkmark-circle' : 'time'}
                  size={18}
                  color={d.status === 'approved' ? colors.system.green : colors.system.orange}
                />
                <Text style={[styles_dynamic.historyDesc, { color: colors.text.primary }]}>
                  {d.description}
                </Text>
                <Text
                  style={[styles_dynamic.historyAmt, { color: colors.text.secondary }]}
                  numberOfLines={1}
                >
                  {formatDisplayCopGoals(d.amount)}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </ChildUnitScreenLayout>

      {/* Modal: Ahorrar Dinero */}
      <DepositModal
        visible={showDeposit}
        onClose={() => setShowDeposit(false)}
        goals={goals}
        preSelected={preSelectedGoal}
        childId={activeChildId}
        colors={colors}
      />

      {/* Modal: Nueva Meta */}
      <NewGoalModal
        visible={showNewGoal}
        onClose={() => setShowNewGoal(false)}
        childId={activeChildId}
        colors={colors}
      />
    </>
  );
}

// ── SUB-COMPONENTES: MODALES ──────────────────────────────────────────────────

function DepositModal({
  visible,
  onClose,
  goals,
  preSelected,
  childId,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  goals: SavingsGoal[];
  preSelected: { id: string; title: string } | null;
  childId: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const submitDeposit = useSavingsStore((s) => s.submitDeposit);

  useEffect(() => {
    if (!visible) return;
    setSelectedGoalId(preSelected?.id ?? goals[0]?.id ?? '');
  }, [visible, preSelected?.id, goals]);

  const handleDeposit = () => {
    const num = parseMoneyAmountInt(amount);
    if (!goals.length) {
      showCetiNotice({
        variant: 'info',
        title: 'Primero una meta',
        message: 'Crea una meta con el botón «Nueva meta» para registrar ahorros.',
      });
      return;
    }
    if (!num || !desc.trim() || !selectedGoalId) {
      showCetiNotice({
        variant: 'error',
        title: 'Revisa los datos',
        message: 'Indica cuánto ahorraste, de dónde salió y elige una meta.',
      });
      return;
    }
    submitDeposit(childId, num, desc.trim(), selectedGoalId);
    showCetiNotice({
      variant: 'success',
      title: '¡Enviado!',
      message: 'Un adulto debe confirmar tu depósito en la app.',
    });
    setAmount('');
    setDesc('');
    onClose();
  };

  return (
    <CetiBottomSheet
      visible={visible}
      onClose={onClose}
      title="Registrar ahorro"
      subtitle="Tu familia debe aprobarlo"
      closeOnBackdropPress
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View>
          <TextInput
            style={[
              mStyles.input,
              {
                backgroundColor: colors.materials.highlight,
                color: colors.text.primary,
                borderColor: colors.materials.border,
              },
            ]}
            placeholder="¿Cuánto dinero? (ej: 50.000)"
            placeholderTextColor={colors.text.tertiary}
            keyboardType="numeric"
            value={amount}
            onChangeText={(t) => setAmount(formatMoneyInputThousands(t))}
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
            placeholder="¿De dónde salió? (Ej: Domingo)"
            placeholderTextColor={colors.text.tertiary}
            value={desc}
            onChangeText={setDesc}
          />
          <Text style={[mStyles.label, { color: colors.text.secondary }]}>¿Para qué meta es?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }}
          >
            {goals.map((g) => (
              <TouchableOpacity
                key={g.id}
                onPress={() => setSelectedGoalId(g.id)}
                style={[
                  mStyles.goalChip,
                  {
                    backgroundColor: colors.materials.highlight,
                    borderColor: colors.materials.border,
                  },
                  selectedGoalId === g.id && {
                    borderColor: colors.brand.primary,
                    backgroundColor: colors.fill.brandSubtle,
                  },
                ]}
              >
                <Text
                  style={[
                    mStyles.chipText,
                    { color: colors.text.primary },
                    selectedGoalId === g.id && { color: colors.brand.primary },
                  ]}
                >
                  {g.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={mStyles.row}>
            <CetiButton
              label="Cancelar"
              onPress={onClose}
              variant="glass"
              size="medium"
              style={{ flex: 1 }}
            />
            <CetiButton
              label="Enviar"
              onPress={handleDeposit}
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

function NewGoalModal({
  visible,
  onClose,
  childId,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  childId: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const addChildGoal = useSavingsStore((s) => s.addChildGoal);

  const handleCreate = () => {
    const num = parseMoneyAmountInt(target);
    if (!title.trim() || !num) {
      showCetiNotice({
        variant: 'error',
        title: 'Faltan datos',
        message: 'Pon nombre a tu meta y cuánto cuesta en pesos.',
      });
      return;
    }
    addChildGoal(childId, {
      title: title.trim(),
      targetAmount: num,
      category: 'custom',
      emoji: '🎯',
      description: '',
      frequency: 'total',
    });
    showCetiNotice({
      variant: 'success',
      title: '¡Meta lista!',
      message: 'Ahora sí a ahorrar para lograrla.',
    });
    setTitle('');
    setTarget('');
    onClose();
  };

  return (
    <CetiBottomSheet
      visible={visible}
      onClose={onClose}
      title="Nueva meta"
      subtitle="¿Qué quieres conseguir?"
      closeOnBackdropPress
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View>
          <TextInput
            style={[
              mStyles.input,
              {
                backgroundColor: colors.materials.highlight,
                color: colors.text.primary,
                borderColor: colors.materials.border,
              },
            ]}
            placeholder="¿Qué quieres comprar o hacer?"
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
            placeholder="¿Cuánto cuesta? (ej: 120.000)"
            placeholderTextColor={colors.text.tertiary}
            keyboardType="numeric"
            value={target}
            onChangeText={(t) => setTarget(formatMoneyInputThousands(t))}
          />
          <View style={mStyles.row}>
            <CetiButton
              label="Cancelar"
              onPress={onClose}
              variant="glass"
              size="medium"
              style={{ flex: 1 }}
            />
            <CetiButton
              label="Crear meta"
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

const getStyles = (colors: any) =>
  StyleSheet.create({
    economyRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    economyCard: {
      flex: 1,
      borderRadius: 20,
      borderWidth: 1,
      overflow: 'hidden',
      minHeight: 80,
    },
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

    actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 26 },
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
    sectionTitle: { ...Typography.title3, fontWeight: '800', marginBottom: 14 },

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
  cardTitleBlock: { flex: 1, minWidth: 0, paddingRight: 6, gap: 6 },
  goalName: { ...Typography.headline, fontWeight: '800' },
  goalStatus: { ...Typography.caption1 },
  cardDepositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
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
});

const mStyles = StyleSheet.create({
  label: { ...Typography.caption1, marginTop: 10 },
  input: { borderRadius: 20, padding: 20, ...Typography.body, borderWidth: 1, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  goalChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
  },
  chipText: { ...Typography.caption1, fontWeight: '700' },
});
