// app/(child)/goals.tsx — Metas Visuales y Dinámicas para Niños (Versión sin iconos y funcional)
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Modal, Alert, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@shared/constants/typography';
import { useSavingsStore, SavingsGoal } from '@features/savings/store/useSavingsStore';
import { useChildStore } from '@features/auth/store/useChildStore';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import CetiButton from '@shared/components/CetiButton';
import PageHeader from '@shared/components/PageHeader';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';

// ── Tarjeta de Meta Visual (Sin Iconos) ───────────────────────────────────────
function VisualGoalCard({ goal, delay, onDeposit }: { goal: SavingsGoal; delay: number; onDeposit: () => void }) {
  const colors = useThemeColors();
  const progress = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={[styles.goalCard, { backgroundColor: colors.materials.base, borderColor: colors.materials.border }]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.goalName, { color: colors.text.primary }]}>{goal.title}</Text>
          <Text style={[styles.goalStatus, { color: colors.text.tertiary }]}>
            {progress === 100 ? '¡Meta alcanzada!' : `${goal.source === 'parent' ? 'Reto de Papá' : 'Tu propia meta'}`}
          </Text>
        </View>
        {progress === 100 ? (
          <Ionicons name="trophy" size={24} color={colors.gold.primary} />
        ) : (
          <TouchableOpacity style={[styles.cardDepositBtn, { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary }]} onPress={onDeposit}>
            <Ionicons name="add-circle" size={18} color={colors.text.onBrand} />
            <Text style={[styles.cardDepositText, { color: colors.text.onBrand }]}>¡Ahorrar!</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.progressArea}>
        <View style={styles.barContainer}>
          <View style={[styles.barBg, { backgroundColor: colors.separator.transparent }]}>
            <View style={[styles.barFill, { width: `${progress}%` as any, backgroundColor: colors.brand.primary }]} />
          </View>
          {progress > 0 && progress < 100 && (
            <Animated.View style={[styles.progressIndicator, { left: `${progress}%` as any, backgroundColor: colors.brand.primary, shadowColor: colors.brand.primary }]} />
          )}
        </View>
        <View style={styles.amountRow}>
          <Text style={[styles.currentAmount, { color: colors.text.primary }]}>${goal.currentAmount.toLocaleString('es-CO')}</Text>
          <Text style={[styles.targetAmount, { color: colors.text.tertiary }]}>de ${goal.targetAmount.toLocaleString('es-CO')}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function GoalsScreen() {
  const colors = useThemeColors();
  const mode = useThemeStore(s => s.mode);
  const styles_dynamic = getStyles(colors, mode);

  const { id: activeChildId, nickname } = useChildStore();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [preSelectedGoal, setPreSelectedGoal] = useState<{id: string, title: string} | null>(null);
  
  const rawGoals = useSavingsStore(s => s.goals);
  const rawDeposits = useSavingsStore(s => s.deposits);
  
  const goals = rawGoals.filter(g => g.childId === activeChildId);
  const deposits = rawDeposits.filter(d => d.childId === activeChildId);
  const totalApproved = deposits.filter(d => d.status === 'approved').reduce((a, b) => a + b.amount, 0);

  const openDeposit = (goal?: SavingsGoal) => {
    if (goal) {
      setPreSelectedGoal({ id: goal.id, title: goal.title });
    } else {
      setPreSelectedGoal(null);
    }
    setShowDeposit(true);
  };

  return (
    <ScreenWrapper style={styles_dynamic.root}>
      <ScrollView contentContainerStyle={styles_dynamic.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Header Dinámico */}
        <View style={styles_dynamic.header}>
          <PageHeader 
            overline="Progreso"
            title="Mis Ahorros"
            subtitle={`¡Hola ${nickname}, ahorra para lo que sueñas!`}
            style={{ flex: 1 }}
          />
        </View>

        {/* Alcancía de Ahorro Verificado */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={[styles_dynamic.piggyCard, { backgroundColor: colors.gold.primary + '15', borderColor: colors.gold.primary + '30' }]}>
          <View style={[styles_dynamic.piggyIcon, { backgroundColor: colors.gold.primary + '20' }]}>
            <Ionicons name="wallet" size={32} color={colors.gold.primary} />
          </View>
          <View>
            <Text style={[styles_dynamic.piggyLabel, { color: colors.gold.primary }]}>Ahorro Confirmado</Text>
            <Text style={[styles_dynamic.piggyValue, { color: colors.text.primary }]}>${totalApproved.toLocaleString('es-CO')}</Text>
            <View style={styles_dynamic.verifyBadge}>
              <Ionicons name="checkmark-circle" size={12} color={colors.system.green} />
              <Text style={[styles_dynamic.verifyText, { color: colors.system.green }]}>Confirmado por papá</Text>
            </View>
          </View>
        </Animated.View>

        {/* Botones de Acción */}
        <View style={styles_dynamic.actionsRow}>
          <TouchableOpacity style={[styles_dynamic.actionBtn, { backgroundColor: colors.brand.primary }]} onPress={() => openDeposit()}>
            <Ionicons name="add-circle" size={20} color={colors.text.onBrand} />
            <Text style={[styles_dynamic.actionBtnText, { color: colors.text.onBrand }]}>¡Ahorrar!</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles_dynamic.actionBtn, { backgroundColor: colors.background.secondary, borderColor: colors.materials.border, borderWidth: 1 }]} onPress={() => setShowNewGoal(true)}>
            <Ionicons name="flag" size={18} color={colors.text.primary} />
            <Text style={[styles_dynamic.actionBtnText, { color: colors.text.primary }]}>Nueva meta</Text>
          </TouchableOpacity>
        </View>

        {/* Metas Activas */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles_dynamic.section}>
          <Text style={[styles_dynamic.sectionTitle, { color: colors.text.primary }]}>Tus Metas</Text>
          {goals.length > 0 ? (
            goals.map((g, i) => (
              <VisualGoalCard 
                key={g.id} 
                goal={g} 
                delay={400 + i * 100} 
                onDeposit={() => openDeposit(g)}
              />
            ))
          ) : (
            <View style={[styles_dynamic.emptyCard, { backgroundColor: colors.materials.base, borderColor: colors.materials.border }]}>
              <Ionicons name="star-outline" size={40} color={colors.separator.opaque} />
              <Text style={[styles_dynamic.emptyText, { color: colors.text.tertiary }]}>¿Cuál será tu primera meta?</Text>
              <CetiButton label="Crear mi meta" onPress={() => setShowNewGoal(true)} variant="glass" size="small" />
            </View>
          )}
        </Animated.View>

        {/* Historial de Ahorro Simplificado */}
        <Animated.View entering={FadeInDown.delay(500).springify()} style={styles_dynamic.section}>
          <Text style={[styles_dynamic.sectionTitle, { color: colors.text.primary }]}>Mis ahorros</Text>
          <View style={[styles_dynamic.historyBox, { backgroundColor: colors.materials.base, borderColor: colors.materials.border }]}>
            {deposits.slice(0, 3).map(d => (
              <View key={d.id} style={styles_dynamic.historyItem}>
                <Ionicons name={d.status === 'approved' ? 'checkmark-circle' : 'time'} size={18} color={d.status === 'approved' ? colors.system.green : colors.system.orange} />
                <Text style={[styles_dynamic.historyDesc, { color: colors.text.primary }]}>{d.description}</Text>
                <Text style={[styles_dynamic.historyAmt, { color: colors.text.primary }]}>${d.amount.toLocaleString('es-CO')}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

      </ScrollView>

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
    </ScreenWrapper>
  );
}

// ── SUB-COMPONENTES: MODALES ──────────────────────────────────────────────────

function DepositModal({ visible, onClose, goals, preSelected, childId, colors }: any) {
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState(preSelected?.id || '');
  const submitDeposit = useSavingsStore(s => s.submitDeposit);

  const handleDeposit = () => {
    const num = parseInt(amount.replace(/\D/g, ''), 10);
    if (!num || !desc.trim() || !selectedGoalId) {
      return Alert.alert('Ops', 'Dinos cuánto ahorraste y para qué meta.');
    }
    submitDeposit(childId, num, desc.trim(), selectedGoalId);
    Alert.alert('¡Excelente!', 'Papá debe confirmar tu depósito ahora.');
    setAmount('');
    setDesc('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={mStyles.overlay}>
        <View style={[mStyles.sheet, { backgroundColor: colors.background.secondary }]}>
          <Text style={[mStyles.title, { color: colors.text.primary }]}>¡Ahorrar!</Text>
          
          <TextInput 
            style={[mStyles.input, { backgroundColor: colors.separator.transparent, color: colors.text.primary, borderColor: colors.materials.border }]} 
            placeholder="¿Cuánto dinero? ($)" 
            placeholderTextColor={colors.text.tertiary}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
          
          <TextInput 
            style={[mStyles.input, { backgroundColor: colors.separator.transparent, color: colors.text.primary, borderColor: colors.materials.border }]} 
            placeholder="¿De dónde salió? (Ej: Domingo)" 
            placeholderTextColor={colors.text.tertiary}
            value={desc}
            onChangeText={setDesc}
          />

          <Text style={[mStyles.label, { color: colors.text.secondary }]}>¿Para qué meta es?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {goals.map((g: any) => (
              <TouchableOpacity 
                key={g.id} 
                onPress={() => setSelectedGoalId(g.id)}
                style={[mStyles.goalChip, { backgroundColor: colors.separator.transparent, borderColor: colors.materials.border }, selectedGoalId === g.id && { borderColor: colors.brand.primary, backgroundColor: colors.brand.primary + '10' }]}
              >
                <Text style={[mStyles.chipText, { color: colors.text.primary }, selectedGoalId === g.id && { color: colors.brand.primary }]}>{g.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={mStyles.row}>
            <CetiButton label="Cancelar" onPress={onClose} variant="glass" size="medium" style={{ flex: 1 }} />
            <CetiButton label="Ahorrar" onPress={handleDeposit} variant="primary" size="medium" style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function NewGoalModal({ visible, onClose, childId, colors }: any) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const addChildGoal = useSavingsStore(s => s.addChildGoal);

  const handleCreate = () => {
    const num = parseInt(target.replace(/\D/g, ''), 10);
    if (!title.trim() || !num) return Alert.alert('Ops', 'Dinos el nombre de tu meta y cuánto cuesta.');
    addChildGoal(childId, {
      title: title.trim(),
      targetAmount: num,
      category: 'custom',
      emoji: '🎯',
      description: '',
      frequency: 'total'
    });
    Alert.alert('¡Meta Creada!', '¡A por ella!');
    setTitle('');
    setTarget('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={mStyles.overlay}>
        <View style={[mStyles.sheet, { backgroundColor: colors.background.secondary }]}>
          <Text style={[mStyles.title, { color: colors.text.primary }]}>Nueva Meta</Text>
          <TextInput 
            style={[mStyles.input, { backgroundColor: colors.separator.transparent, color: colors.text.primary, borderColor: colors.materials.border }]} 
            placeholder="¿Qué quieres comprar?" 
            placeholderTextColor={colors.text.tertiary}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput 
            style={[mStyles.input, { backgroundColor: colors.separator.transparent, color: colors.text.primary, borderColor: colors.materials.border }]} 
            placeholder="¿Cuánto cuesta? ($)" 
            placeholderTextColor={colors.text.tertiary}
            keyboardType="numeric"
            value={target}
            onChangeText={setTarget}
          />
          <View style={mStyles.row}>
            <CetiButton label="Cancelar" onPress={onClose} variant="glass" size="medium" style={{ flex: 1 }} />
            <CetiButton label="Crear Meta" onPress={handleCreate} variant="primary" size="medium" style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (colors: any, mode: string) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.base },
  scroll: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 120, gap: 24 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  piggyCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 32, padding: 24, gap: 16, borderWidth: 1 },
  piggyIcon: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  piggyLabel: { ...Typography.caption1, marginBottom: 2 },
  piggyValue: { ...Typography.title1, fontWeight: '900' },
  verifyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  verifyText: { fontSize: 10, fontWeight: '700' },

  actionsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionBtnText: { ...Typography.subheadline, fontWeight: '800' },

  section: { gap: 16 },
  sectionTitle: { ...Typography.title3, fontWeight: '800' },

  emptyCard: { padding: 40, alignItems: 'center', gap: 16, borderRadius: 32, borderStyle: 'dashed', borderWidth: 2 },
  emptyText: { ...Typography.subheadline, textAlign: 'center' },

  historyBox: { borderRadius: 24, padding: 8, borderWidth: 1 },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  historyDesc: { flex: 1, ...Typography.caption1 },
  historyAmt: { ...Typography.headline, fontWeight: '700' },
});

const styles = StyleSheet.create({
  goalCard: { borderRadius: 28, padding: 20, gap: 20, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalName: { ...Typography.headline, fontWeight: '800' },
  goalStatus: { ...Typography.caption1 },
  cardDepositBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  cardDepositText: { ...Typography.caption1, fontWeight: '800' },

  progressArea: { gap: 12 },
  barContainer: { height: 12, borderRadius: 6, justifyContent: 'center' },
  barBg: { ...StyleSheet.absoluteFillObject, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  progressIndicator: { position: 'absolute', width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: '#FFF', marginLeft: -8 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currentAmount: { ...Typography.headline, fontWeight: '800' },
  targetAmount: { ...Typography.caption1 },
});

const mStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, gap: 16, paddingBottom: 48 },
  title: { ...Typography.title2, fontWeight: '800', marginBottom: 8 },
  label: { ...Typography.caption1, marginTop: 10 },
  input: { borderRadius: 20, padding: 20, ...Typography.body, borderWidth: 1 },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  goalChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginRight: 8, borderWidth: 1 },
  chipText: { ...Typography.caption1, fontWeight: '700' },
});
