// app/(parent)/savings-dashboard.tsx — Dashboard analítico de ahorros para el padre
import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@shared/constants/typography';
import type { ThemeColors } from '@shared/constants/colors';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useShallow } from 'zustand/react/shallow';
import {
  OVERRIDE_CHILDREN,
  DEFAULT_SAVINGS_WEEKS,
  WEEK_LABELS,
  type ChildDashboardSummary,
} from '@shared/data/parentDashboard';
import CetiButton from '@shared/components/CetiButton';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import { formatMoneyInputThousands, parseMoneyAmountInt } from '@shared/utils/moneyInputFormat';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import { showCetiNotice } from '@shared/store/useCetiOverlayStore';
import {
  useChildrenRegistryStore,
  snapshotActiveChildFromStore,
  type SerializedChildProfile,
} from '@features/auth/store/useChildrenRegistryStore';
// ── Mini Bar Chart ────────────────────────────────────────────────────────────
function BarChart({ data, color }: { data: number[]; color: string }) {
  const colors = useThemeColors();
  const chart = useMemo(() => createChartStyles(colors), [colors]);
  const max = Math.max(...data, 1);
  return (
    <View style={chart.container}>
      {data.map((v, i) => (
        <View key={i} style={chart.col}>
          <View style={chart.barWrap}>
            <View style={[chart.bar, { height: `${(v / max) * 100}%`, backgroundColor: color }]} />
          </View>
          <Text style={chart.label}>{WEEK_LABELS[i]}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Child Summary Card ────────────────────────────────────────────────────────
function ChildCard({
  child,
  isSelected,
  onPress,
}: {
  child: ChildDashboardSummary;
  isSelected: boolean;
  onPress: () => void;
}) {
  const pending = useSavingsStore(
    (s) => s.deposits.filter((d) => d.childId === child.id && d.status === 'pending').length
  );
  const colors = useThemeColors();
  const cs = useMemo(() => createChildCardStyles(colors), [colors]);
  return (
    <TouchableOpacity onPress={onPress} style={[cs.card, isSelected && cs.cardSelected]}>
      <Text style={cs.emoji}>{child.avatarEmoji}</Text>
      <View style={cs.info}>
        <Text style={cs.name}>{child.nickname}</Text>
        <Text style={cs.age}>{child.age} años</Text>
      </View>
      {pending > 0 && (
        <View style={cs.badge}>
          <Text style={cs.badgeText}>{pending}</Text>
        </View>
      )}
      {isSelected && <Ionicons name="checkmark-circle" size={18} color={colors.brand.primary} />}
    </TouchableOpacity>
  );
}

// ── Deposit Approval Card ─────────────────────────────────────────────────────
function DepositApprovalCard({ deposit, child }: { deposit: any; child: ChildDashboardSummary }) {
  const [showModal, setShowModal] = useState(false);
  const [note, setNote] = useState('');
  const colors = useThemeColors();
  const dep = useMemo(() => createDepStyles(colors), [colors]);
  const approve = useSavingsStore((s) => s.approveDeposit);
  const reject = useSavingsStore((s) => s.rejectDeposit);

  return (
    <>
      <View style={dep.card}>
        <View style={dep.header}>
          <Text style={dep.emoji}>{child.avatarEmoji}</Text>
          <View style={dep.info}>
            <Text style={dep.name}>{child.nickname} quiere registrar:</Text>
            <Text style={dep.desc}>{deposit.description}</Text>
            {deposit.receiptNote && <Text style={dep.receipt}>📝 {deposit.receiptNote}</Text>}
          </View>
          <Text style={dep.amount}>${deposit.amount.toLocaleString('es-CO')}</Text>
        </View>
        <View style={dep.actions}>
          <TouchableOpacity style={dep.rejectBtn} onPress={() => setShowModal(true)}>
            <Ionicons name="close" size={16} color={colors.system.red} />
            <Text style={[dep.btnText, { color: colors.system.red }]}>Rechazar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={dep.approveBtn}
            onPress={() => {
              approve(deposit.id, '¡Muy bien! Tu ahorro fue confirmado. 🎉');
            }}
          >
            <Ionicons name="checkmark" size={16} color={colors.system.green} />
            <Text style={[dep.btnText, { color: colors.system.green }]}>Aprobar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <CetiBottomSheet
        visible={showModal}
        onClose={() => setShowModal(false)}
        title={`Rechazar solicitud`}
        subtitle={child.nickname}
        closeOnBackdropPress
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View>
            <Text style={[dep.modalSub, { color: colors.text.secondary, marginBottom: 4 }]}>
              Explica con calma por qué no puedes aprobar este registro.
            </Text>
            <TextInput
              style={[
                dep.input,
                {
                  backgroundColor: colors.materials.highlight,
                  borderColor: colors.materials.border,
                  color: colors.text.primary,
                },
              ]}
              placeholder="Motivo del rechazo..."
              placeholderTextColor={colors.text.tertiary}
              value={note}
              onChangeText={setNote}
              multiline
            />
            <View style={dep.modalActions}>
              <CetiButton
                label="Volver"
                onPress={() => setShowModal(false)}
                variant="glass"
                size="medium"
                style={{ flex: 1 }}
              />
              <CetiButton
                label="Rechazar"
                onPress={() => {
                  if (!note.trim()) {
                    showCetiNotice({
                      variant: 'error',
                      title: 'Falta el motivo',
                      message: 'Escribe un motivo claro para que el niño entienda.',
                    });
                    return;
                  }
                  reject(deposit.id, note.trim());
                  setShowModal(false);
                }}
                variant="destructive"
                size="medium"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </CetiBottomSheet>
    </>
  );
}

// ── Assign Goal Modal ─────────────────────────────────────────────────────────
function AssignGoalModal({
  visible,
  onClose,
  childId,
  childName,
}: {
  visible: boolean;
  onClose: () => void;
  childId: string;
  childName: string;
}) {
  const colors = useThemeColors();
  const dep = useMemo(() => createDepStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const addParentGoal = useSavingsStore((s) => s.addParentGoal);

  const handle = () => {
    const num = parseMoneyAmountInt(amount);
    if (!title.trim() || !num) {
      showCetiNotice({
        variant: 'error',
        title: 'Datos incompletos',
        message: 'Escribe el nombre del reto y un monto de ahorro en pesos.',
      });
      return;
    }
    addParentGoal(childId, {
      title: title.trim(),
      description: desc.trim(),
      emoji: '',
      targetAmount: num,
      frequency: 'total',
      category: 'custom',
    });
    setTitle('');
    setAmount('');
    setDesc('');
    onClose();
    showCetiNotice({
      variant: 'success',
      title: 'Reto asignado',
      message: `${childName} podrá verlo en su sección de metas.`,
    });
  };

  return (
    <CetiBottomSheet
      visible={visible}
      onClose={onClose}
      title="Asignar reto"
      subtitle={childName}
      closeOnBackdropPress
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View>
          <Text style={[dep.modalSub, { color: colors.text.secondary }]}>
            El niño verá este reto en Metas dentro de su perfil.
          </Text>
          <TextInput
            style={[
              dep.input,
              {
                backgroundColor: colors.materials.highlight,
                borderColor: colors.materials.border,
                color: colors.text.primary,
              },
            ]}
            placeholder="Nombre del reto"
            placeholderTextColor={colors.text.tertiary}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[
              dep.input,
              {
                backgroundColor: colors.materials.highlight,
                borderColor: colors.materials.border,
                color: colors.text.primary,
              },
            ]}
            placeholder="Meta de ahorro (COP, ej: 500.000)"
            placeholderTextColor={colors.text.tertiary}
            keyboardType="numeric"
            value={amount}
            onChangeText={(t) => setAmount(formatMoneyInputThousands(t))}
          />
          <TextInput
            style={[
              dep.input,
              {
                height: 70,
                backgroundColor: colors.materials.highlight,
                borderColor: colors.materials.border,
                color: colors.text.primary,
              },
            ]}
            multiline
            placeholder="Motivación para el niño (opcional)"
            placeholderTextColor={colors.text.tertiary}
            value={desc}
            onChangeText={setDesc}
          />
          <View style={dep.modalActions}>
            <CetiButton
              label="Cancelar"
              onPress={onClose}
              variant="glass"
              size="medium"
              style={{ flex: 1 }}
            />
            <CetiButton
              label="Asignar"
              onPress={handle}
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

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function SavingsDashboard() {
  const colors = useThemeColors();
  const styles = useMemo(() => createDashboardMainStyles(colors), [colors]);

  const getTotalSaved = useSavingsStore((s) => s.getTotalSaved);
  const allDepositsFlat = useSavingsStore((s) => s.deposits);

  const registry = useChildrenRegistryStore(
    useShallow((s) => ({
      profiles: s.profiles,
      order: s.order,
    }))
  );

  const children = useMemo((): ChildDashboardSummary[] => {
    const mocks = Object.values(OVERRIDE_CHILDREN);
    if (mocks.length > 0) return mocks;

    const seen = new Set<string>();
    const rows: ChildDashboardSummary[] = [];

    const add = (p: SerializedChildProfile) => {
      if (!p.isOnboarded || !p.id || seen.has(p.id)) return;
      seen.add(p.id);
      const pendingForChild = allDepositsFlat.filter(
        (d) => d.childId === p.id && d.status === 'pending'
      ).length;
      const history = DEFAULT_SAVINGS_WEEKS[p.id] ??
        DEFAULT_SAVINGS_WEEKS.all ?? [0, 0, 0, 0, 0, 0, 0, 0];
      rows.push({
        id: p.id,
        nickname: p.nickname,
        fullName: p.fullName,
        age: p.age,
        avatarEmoji: p.avatarEmoji || '🦁',
        xp: p.xp,
        streak: p.streak,
        totalSaved: getTotalSaved(p.id),
        totalLessons: p.totalLessonsCompleted,
        pendingDeposits: pendingForChild,
        accuracy: p.accuracy,
        savingsHistory: history,
        educationHistory: p.educationHistory ?? [],
      });
    };

    for (const id of registry.order) {
      const prof = registry.profiles[id];
      if (prof) add(prof);
    }

    const live = snapshotActiveChildFromStore();
    if (live) add(live);

    return rows;
  }, [registry.order, registry.profiles, allDepositsFlat, getTotalSaved]);

  const [selectedId, setSelectedId] = useState(children[0]?.id ?? '');
  const [showAssign, setShowAssign] = useState(false);

  useEffect(() => {
    if (children.length === 0) {
      setSelectedId('');
      return;
    }
    setSelectedId((prev) => (prev && children.some((c) => c.id === prev) ? prev : children[0].id));
  }, [children]);

  const selected = children.find((c) => c.id === selectedId) ?? children[0];

  const { allPending, goals } = useSavingsStore(
    useShallow((s) => ({
      allPending: s.deposits.filter((d) => d.status === 'pending'),
      goals: s.goals.filter((g) => g.childId === selectedId),
    }))
  );

  const totalPending = allPending.length;
  const savingsHistory = DEFAULT_SAVINGS_WEEKS[selectedId] ??
    DEFAULT_SAVINGS_WEEKS['all'] ?? [0, 0, 0, 0, 0, 0, 0, 0];
  const totalSaved = savingsHistory.reduce((a: number, b: number) => a + b, 0);

  const totalAllChildren = children.reduce(
    (a: number, c: ChildDashboardSummary) => a + c.totalSaved,
    0
  );
  const pendingForSelected = allPending.filter((d) => d.childId === selectedId);

  if (children.length === 0 || !selected) {
    return (
      <ScreenWrapper style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <PageHeader
            overline="Gestión"
            title="Ahorros familiares"
            subtitle="Conecta un perfil infantil desde el onboarding para gestionar metas y depósitos"
            style={{ marginBottom: 20 }}
          />
          <Text style={{ ...Typography.body, color: colors.text.secondary }}>
            Completa primero la configuración del niño desde el perfil parental o desde el centro de
            cuenta.
          </Text>
        </ScrollView>
      </ScreenWrapper>
    );
  }
  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PageHeader
          overline="Gestión"
          title="Ahorros Familiares"
          subtitle="Gestiona las metas y ahorros de tus hijos"
          style={{ marginBottom: 20 }}
        />

        {/* General Stats */}
        <Animated.View entering={motion.enterDown(40)} style={styles.statsRow}>
          {[
            {
              label: 'Hijos enlazados',
              value: children.length,
              icon: 'people',
              color: colors.system.blue,
            },
            {
              label: 'Total ahorrado',
              value: `$${(totalAllChildren / 1000).toFixed(0)}K`,
              icon: 'wallet',
              color: colors.system.green,
            },
            { label: 'Pendientes', value: totalPending, icon: 'time', color: colors.system.orange },
          ].map((s, i) => (
            <View key={i} style={styles.statTile}>
              <Ionicons name={s.icon as any} size={18} color={s.color} />
              <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLbl}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Child selector */}
        <Animated.View entering={motion.enterDown(72)} style={styles.section}>
          <Text style={styles.sectionTitle}>Seleccionar hijo</Text>
          {children.map((c) => (
            <ChildCard
              key={c.id}
              child={c}
              isSelected={c.id === selectedId}
              onPress={() => {
                useChildrenRegistryStore.getState().activateChildProfile(c.id);
                setSelectedId(c.id);
              }}
            />
          ))}
        </Animated.View>

        {/* Selected child detail */}
        <Animated.View entering={motion.enterDown(104)} style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>
              {selected.avatarEmoji} {selected.nickname}
            </Text>
            <TouchableOpacity style={styles.assignBtn} onPress={() => setShowAssign(true)}>
              <Ionicons name="flag" size={14} color={colors.brand.primary} />
              <Text style={styles.assignBtnText}>Asignar reto</Text>
            </TouchableOpacity>
          </View>

          {/* Mini stats del hijo seleccionado */}
          <View style={styles.childStats}>
            {[
              { label: 'Racha', value: `${selected.streak}`, color: colors.system.orange },
              { label: 'Lecciones', value: selected.totalLessons, color: colors.system.blue },
              { label: 'XP', value: selected.xp, color: colors.gold.primary },
            ].map((s, i) => (
              <View key={i} style={styles.childStat}>
                <Text style={[styles.childStatVal, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.childStatLbl}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Chart de ahorros */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Ahorros — últimas 8 semanas</Text>
              <Text style={styles.chartTotal}>${totalSaved.toLocaleString('es-CO')}</Text>
            </View>
            <BarChart data={savingsHistory} color={colors.system.green} />
          </View>

          {/* Goals progress */}
          {goals.length > 0 && (
            <View style={styles.goalsSection}>
              <Text style={styles.subsectionTitle}>Metas activas</Text>
              {goals.slice(0, 4).map((g) => {
                const pct =
                  g.targetAmount > 0 ? Math.min((g.currentAmount / g.targetAmount) * 100, 100) : 0;
                return (
                  <View key={g.id} style={styles.goalRow}>
                    <Text style={styles.goalRowEmoji}>{g.emoji}</Text>
                    <View style={styles.goalRowInfo}>
                      <View style={styles.goalRowHeader}>
                        <Text style={styles.goalRowName}>{g.title}</Text>
                        <Text style={styles.goalRowPct}>{pct.toFixed(0)}%</Text>
                      </View>
                      <View style={styles.goalRowBg}>
                        <View style={[styles.goalRowFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.goalRowSub}>
                        ${g.currentAmount.toLocaleString('es-CO')} / $
                        {g.targetAmount.toLocaleString('es-CO')}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* Approvals section */}
        {pendingForSelected.length > 0 && (
          <Animated.View entering={motion.enterDown(136)} style={styles.section}>
            <Text style={styles.sectionTitle}>
              ⏳ Aprobaciones pendientes — {selected.nickname}
            </Text>
            {pendingForSelected.map((d) => (
              <DepositApprovalCard key={d.id} deposit={d} child={selected} />
            ))}
          </Animated.View>
        )}
      </ScrollView>

      <AssignGoalModal
        visible={showAssign}
        onClose={() => setShowAssign(false)}
        childId={selectedId}
        childName={selected.nickname}
      />
    </ScreenWrapper>
  );
}

// ── Styles (por tema) ─────────────────────────────────────────────────────────

function createDashboardMainStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background.base },
    scroll: {
      paddingTop: Platform.OS === 'ios' ? 64 : 44,
      paddingHorizontal: 16,
      paddingBottom: 140,
      gap: 20,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { ...Typography.largeTitle, color: c.text.primary, letterSpacing: -1 },
    headerSub: { ...Typography.subheadline, color: c.text.secondary },
    alertBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.fill.orangeSubtle,
      borderRadius: 99,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: c.materials.border,
    },
    alertText: { ...Typography.headline, color: c.system.orange },

    statsRow: { flexDirection: 'row', gap: 10 },
    statTile: {
      flex: 1,
      backgroundColor: c.materials.base,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.materials.border,
      padding: 14,
      alignItems: 'center',
      gap: 4,
    },
    statVal: { ...Typography.title2, fontWeight: '800' },
    statLbl: { ...Typography.caption2, color: c.text.tertiary, textAlign: 'center' },

    section: { gap: 12 },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { ...Typography.title3, color: c.text.primary },
    assignBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.fill.brandSubtle,
      borderRadius: 99,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: c.materials.border,
    },
    assignBtnText: { ...Typography.caption1, color: c.brand.primary, fontWeight: '700' },

    childStats: { flexDirection: 'row', gap: 10 },
    childStat: {
      flex: 1,
      backgroundColor: c.materials.base,
      borderRadius: 14,
      padding: 12,
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: c.materials.border,
    },
    childStatVal: { ...Typography.title3, fontWeight: '800' },
    childStatLbl: { ...Typography.caption2, color: c.text.tertiary },

    chartCard: {
      backgroundColor: c.materials.base,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.materials.border,
      padding: 16,
      gap: 12,
    },
    chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    chartTitle: { ...Typography.headline, color: c.text.primary },
    chartTotal: { ...Typography.headline, color: c.system.green },

    goalsSection: { gap: 10 },
    subsectionTitle: { ...Typography.headline, color: c.text.secondary },
    goalRow: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
      backgroundColor: c.materials.highlight,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: c.materials.border,
    },
    goalRowEmoji: { fontSize: 24, paddingTop: 2 },
    goalRowInfo: { flex: 1, gap: 6 },
    goalRowHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    goalRowName: { ...Typography.headline, color: c.text.primary },
    goalRowPct: { ...Typography.caption1, color: c.brand.primary },
    goalRowBg: {
      height: 5,
      backgroundColor: c.background.tertiary,
      borderRadius: 3,
      overflow: 'hidden',
    },
    goalRowFill: { height: '100%', backgroundColor: c.brand.primary, borderRadius: 3 },
    goalRowSub: { ...Typography.caption2, color: c.text.tertiary },
  });
}

function createChildCardStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.materials.base,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.materials.border,
      padding: 14,
    },
    cardSelected: { borderColor: c.brand.primary, backgroundColor: c.fill.brandSubtle },
    emoji: { fontSize: 28 },
    info: { flex: 1 },
    name: { ...Typography.headline, color: c.text.primary },
    age: { ...Typography.caption1, color: c.text.secondary },
    badge: {
      backgroundColor: c.system.orange,
      borderRadius: 99,
      width: 22,
      height: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeText: { ...Typography.caption2, color: c.text.inverse, fontWeight: '800' },
  });
}

function createChartStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 4 },
    col: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
    barWrap: { flex: 1, width: '100%', justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: 4, minHeight: 4 },
    label: { ...Typography.caption2, color: c.text.tertiary, fontSize: 9 },
  });
}

function createDepStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.materials.base,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.materials.border,
      padding: 14,
      gap: 12,
    },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    emoji: { fontSize: 28 },
    info: { flex: 1, gap: 3 },
    name: { ...Typography.headline, color: c.text.primary },
    desc: { ...Typography.body, color: c.text.secondary },
    receipt: { ...Typography.caption1, color: c.text.tertiary, fontStyle: 'italic' },
    amount: { ...Typography.title3, color: c.system.green },
    actions: { flexDirection: 'row', gap: 10 },
    approveBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.fill.greenSubtle,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.materials.border,
      paddingVertical: 10,
    },
    rejectBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.fill.redSubtle,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.materials.border,
      paddingVertical: 10,
    },
    btnText: { ...Typography.headline },
    overlay: {
      flex: 1,
      width: '100%',
      alignSelf: 'stretch',
      alignItems: 'stretch',
      justifyContent: 'flex-end',
    },
    sheet: {
      width: '100%',
      alignSelf: 'stretch',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
      padding: 24,
      gap: 14,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
      maxHeight: '86%',
    },
    modalTitle: { ...Typography.title2, color: c.text.primary },
    modalSub: { ...Typography.caption1, color: c.text.secondary },
    input: {
      backgroundColor: c.materials.highlight,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.materials.border,
      color: c.text.primary,
      padding: 14,
      ...Typography.body,
    },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  });
}
