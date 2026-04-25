// app/(parent)/savings-dashboard.tsx — Dashboard analítico de ahorros para el padre
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Modal, Alert, TextInput } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@shared/constants/colors';
import { Typography } from '@shared/constants/typography';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useShallow } from 'zustand/react/shallow';
import { MOCK_CHILDREN, MOCK_SAVINGS_HISTORY, WEEK_LABELS, MockChild } from '@shared/data/mockSession';
import CetiButton from '@shared/components/CetiButton';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';

// ── Mini Bar Chart ────────────────────────────────────────────────────────────
function BarChart({ data, color }: { data: number[]; color: string }) {
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
function ChildCard({ child, isSelected, onPress }: {
  child: MockChild; isSelected: boolean; onPress: () => void;
}) {
  const pending = useSavingsStore((s) => s.deposits.filter((d) => d.childId === child.id && d.status === 'pending').length);
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
      {isSelected && <Ionicons name="checkmark-circle" size={18} color={Colors.brand.primary} />}
    </TouchableOpacity>
  );
}

// ── Deposit Approval Card ─────────────────────────────────────────────────────
function DepositApprovalCard({ deposit, child }: { deposit: any; child: MockChild }) {
  const [showModal, setShowModal] = useState(false);
  const [note, setNote] = useState('');
  const approve = useSavingsStore(s => s.approveDeposit);
  const reject = useSavingsStore(s => s.rejectDeposit);

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
            <Ionicons name="close" size={16} color={Colors.system.red} />
            <Text style={[dep.btnText, { color: Colors.system.red }]}>Rechazar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={dep.approveBtn} onPress={() => {
            approve(deposit.id, '¡Muy bien! Tu ahorro fue confirmado. 🎉');
          }}>
            <Ionicons name="checkmark" size={16} color={Colors.system.green} />
            <Text style={[dep.btnText, { color: Colors.system.green }]}>Aprobar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={dep.overlay}>
          <View style={dep.sheet}>
            <Text style={dep.modalTitle}>Rechazar solicitud de {child.nickname}</Text>
            <TextInput
              style={dep.input}
              placeholder="Motivo del rechazo..."
              placeholderTextColor={Colors.text.tertiary}
              value={note}
              onChangeText={setNote}
              multiline
            />
            <View style={dep.modalActions}>
              <CetiButton label="Cancelar" onPress={() => setShowModal(false)} variant="glass" size="medium" />
              <CetiButton label="Rechazar" onPress={() => {
                if (!note.trim()) return Alert.alert('Escribe un motivo para que el niño entienda.');
                reject(deposit.id, note.trim());
                setShowModal(false);
              }} variant="primary" size="medium" />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ── Assign Goal Modal ─────────────────────────────────────────────────────────
function AssignGoalModal({ visible, onClose, childId, childName }: {
  visible: boolean; onClose: () => void; childId: string; childName: string;
}) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const addParentGoal = useSavingsStore(s => s.addParentGoal);

  const handle = () => {
    const num = parseInt(amount.replace(/\D/g, ''), 10);
    if (!title.trim() || !num) return Alert.alert('Completa todos los campos.');
    addParentGoal(childId, {
      title: title.trim(), description: desc.trim(),
      emoji: '', targetAmount: num,
      frequency: 'total', category: 'custom',
    });
    setTitle(''); setAmount(''); setDesc('');
    onClose();
    Alert.alert('Reto asignado', `${childName} podrá ver este reto en su app.`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={dep.overlay}>
        <View style={dep.sheet}>
          <Text style={dep.modalTitle}>Asignar reto a {childName}</Text>
          <Text style={dep.modalSub}>El niño verá este reto en su sección de metas.</Text>
          <TextInput style={dep.input} placeholder="Nombre del reto" placeholderTextColor={Colors.text.tertiary} value={title} onChangeText={setTitle} />
          <TextInput style={dep.input} placeholder="Meta de ahorro (COP, ej: 500000)" placeholderTextColor={Colors.text.tertiary} keyboardType="numeric" value={amount} onChangeText={setAmount} />
          <TextInput style={[dep.input, { height: 70 }]} multiline placeholder="Descripción / motivación para el niño" placeholderTextColor={Colors.text.tertiary} value={desc} onChangeText={setDesc} />
          <View style={dep.modalActions}>
            <CetiButton label="Cancelar" onPress={onClose} variant="glass" size="medium" />
            <CetiButton label="Asignar" onPress={handle} variant="primary" size="medium" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function SavingsDashboard() {
  const children = Object.values(MOCK_CHILDREN);
  const [selectedId, setSelectedId] = useState(children[0].id);
  const [showAssign, setShowAssign] = useState(false);

  const selected = MOCK_CHILDREN[selectedId];
  
  const { allPending, goals } = useSavingsStore(
    useShallow((s) => ({
      allPending: s.deposits.filter((d) => d.status === 'pending'),
      goals: s.goals.filter((g) => g.childId === selectedId),
    }))
  );
  const totalPending = allPending.length;
  const savingsHistory = MOCK_SAVINGS_HISTORY[selectedId] ?? [];
  const historyMax = Math.max(...savingsHistory);
  const totalSaved = savingsHistory.reduce((a: number, b: number) => a + b, 0);

  // Stats generales de todos los hijos
  const totalAllChildren = children.reduce((a: number, c: MockChild) => a + c.totalSaved, 0);
  const pendingForSelected = allPending.filter(d => d.childId === selectedId);

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
        <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.statsRow}>
          {[
            { label: 'Hijos enlazados', value: children.length, icon: 'people', color: Colors.system.blue },
            { label: 'Total ahorrado', value: `$${(totalAllChildren / 1000).toFixed(0)}K`, icon: 'wallet', color: Colors.system.green },
            { label: 'Pendientes', value: totalPending, icon: 'time', color: Colors.system.orange },
          ].map((s, i) => (
            <View key={i} style={styles.statTile}>
              <Ionicons name={s.icon as any} size={18} color={s.color} />
              <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLbl}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Child selector */}
        <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Seleccionar hijo</Text>
          {children.map(c => (
            <ChildCard
              key={c.id}
              child={c}
              isSelected={c.id === selectedId}
              onPress={() => setSelectedId(c.id)}
            />
          ))}
        </Animated.View>

        {/* Selected child detail */}
        <Animated.View entering={FadeInDown.delay(350).springify()} style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>{selected.avatarEmoji} {selected.nickname}</Text>
            <TouchableOpacity style={styles.assignBtn} onPress={() => setShowAssign(true)}>
              <Ionicons name="flag" size={14} color={Colors.brand.primary} />
              <Text style={styles.assignBtnText}>Asignar reto</Text>
            </TouchableOpacity>
          </View>

          {/* Mini stats del hijo seleccionado */}
          <View style={styles.childStats}>
            {[
              { label: 'Racha', value: `${selected.streak}`, color: Colors.system.orange },
              { label: 'Lecciones', value: selected.totalLessons, color: Colors.system.blue },
              { label: 'XP', value: selected.xp, color: Colors.gold.primary },
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
            <BarChart data={savingsHistory} color={Colors.system.green} />
          </View>

          {/* Goals progress */}
          {goals.length > 0 && (
            <View style={styles.goalsSection}>
              <Text style={styles.subsectionTitle}>Metas activas</Text>
              {goals.slice(0, 4).map(g => {
                const pct = g.targetAmount > 0 ? Math.min((g.currentAmount / g.targetAmount) * 100, 100) : 0;
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
                      <Text style={styles.goalRowSub}>${g.currentAmount.toLocaleString('es-CO')} / ${g.targetAmount.toLocaleString('es-CO')}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* Approvals section */}
        {pendingForSelected.length > 0 && (
          <Animated.View entering={FadeInDown.delay(450).springify()} style={styles.section}>
            <Text style={styles.sectionTitle}>⏳ Aprobaciones pendientes — {selected.nickname}</Text>
            {pendingForSelected.map(d => (
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

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.base },
  scroll: { paddingTop: Platform.OS === 'ios' ? 64 : 44, paddingHorizontal: 16, paddingBottom: 140, gap: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { ...Typography.largeTitle, color: Colors.text.primary, letterSpacing: -1 },
  headerSub: { ...Typography.subheadline, color: Colors.text.secondary },
  alertBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.system.orange + '20', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.system.orange + '40' },
  alertText: { ...Typography.headline, color: Colors.system.orange },

  statsRow: { flexDirection: 'row', gap: 10 },
  statTile: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14, alignItems: 'center', gap: 4 },
  statVal: { ...Typography.title2, fontWeight: '800' },
  statLbl: { ...Typography.caption2, color: Colors.text.tertiary, textAlign: 'center' },

  section: { gap: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...Typography.title3, color: Colors.text.primary },
  assignBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.brand.primary + '18', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.brand.primary + '40' },
  assignBtnText: { ...Typography.caption1, color: Colors.brand.primary, fontWeight: '700' },

  childStats: { flexDirection: 'row', gap: 10 },
  childStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  childStatVal: { ...Typography.title3, fontWeight: '800' },
  childStatLbl: { ...Typography.caption2, color: Colors.text.tertiary },

  chartCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16, gap: 12 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { ...Typography.headline, color: Colors.text.primary },
  chartTotal: { ...Typography.headline, color: Colors.system.green },

  goalsSection: { gap: 10 },
  subsectionTitle: { ...Typography.headline, color: Colors.text.secondary },
  goalRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  goalRowEmoji: { fontSize: 24, paddingTop: 2 },
  goalRowInfo: { flex: 1, gap: 6 },
  goalRowHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  goalRowName: { ...Typography.headline, color: Colors.text.primary },
  goalRowPct: { ...Typography.caption1, color: Colors.brand.primary },
  goalRowBg: { height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  goalRowFill: { height: '100%', backgroundColor: Colors.brand.primary, borderRadius: 3 },
  goalRowSub: { ...Typography.caption2, color: Colors.text.tertiary },
});

// Child card styles
const cs = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14 },
  cardSelected: { borderColor: Colors.brand.primary, backgroundColor: Colors.brand.primary + '10' },
  emoji: { fontSize: 28 },
  info: { flex: 1 },
  name: { ...Typography.headline, color: Colors.text.primary },
  age: { ...Typography.caption1, color: Colors.text.secondary },
  badge: { backgroundColor: Colors.system.orange, borderRadius: 99, width: 22, height: 22, justifyContent: 'center', alignItems: 'center' },
  badgeText: { ...Typography.caption2, color: '#FFF', fontWeight: '800' },
});

// Chart styles
const chart = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 4 },
  col: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  barWrap: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 4, minHeight: 4 },
  label: { ...Typography.caption2, color: Colors.text.tertiary, fontSize: 9 },
});

// Deposit approval styles
const dep = StyleSheet.create({
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  emoji: { fontSize: 28 },
  info: { flex: 1, gap: 3 },
  name: { ...Typography.headline, color: Colors.text.primary },
  desc: { ...Typography.body, color: Colors.text.secondary },
  receipt: { ...Typography.caption1, color: Colors.text.tertiary, fontStyle: 'italic' },
  amount: { ...Typography.title3, color: Colors.system.green },
  actions: { flexDirection: 'row', gap: 10 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.system.green + '15', borderRadius: 12, borderWidth: 1, borderColor: Colors.system.green + '40', paddingVertical: 10 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.system.red + '15', borderRadius: 12, borderWidth: 1, borderColor: Colors.system.red + '40', paddingVertical: 10 },
  btnText: { ...Typography.headline },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.background.secondary, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalTitle: { ...Typography.title2, color: Colors.text.primary },
  modalSub: { ...Typography.caption1, color: Colors.text.secondary },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', color: Colors.text.primary, padding: 14, ...Typography.body },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
});
