// app/(parent)/dashboard.tsx — Resumen Ejecutivo para Padres (Sin Mocks)
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Modal, Alert, TextInput, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Typography } from '@shared/constants/typography';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useParentStore } from '@features/family/store/useParentStore';
import { useChildStore } from '@features/auth/store/useChildStore';
import CetiButton from '@shared/components/CetiButton';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';

// ── Child Card Compacta ───────────────────────────────────────────────────────
function ChildCard({ child, isSelected, onPress, pendingCount, colors, styles }: { 
  child: any; isSelected: boolean; onPress: () => void; pendingCount: number; colors: any; styles: any;
}) {
  if (!child.isOnboarded) return null;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.childCardContainer}>
      <View style={[styles.childCard, { backgroundColor: colors.materials.base, borderColor: colors.materials.border }, isSelected && { borderColor: colors.brand.primary, backgroundColor: colors.brand.primary + '10' }]}>
        <View style={[styles.cardTop, { backgroundColor: colors.separator.transparent }]}>
          {child.avatarEmoji ? (
            <Text style={styles.cardEmoji}>{child.avatarEmoji}</Text>
          ) : (
            <Ionicons name="person" size={18} color={isSelected ? colors.brand.primary : colors.text.tertiary} />
          )}
          {pendingCount > 0 && <View style={[styles.pendingDot, { backgroundColor: colors.system.red, borderColor: colors.background.base }]} />}
        </View>
        <Text style={[styles.cardName, { color: colors.text.secondary }]}>{child.nickname.split(' ')[0]}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Activity Item Refinado ───────────────────────────────────────────────────
function ActivityItem({ deposit, childName, childEmoji, colors }: { deposit: any; childName: string; childEmoji: string; colors: any }) {
  const approve = useSavingsStore(s => s.approveDeposit);
  return (
    <View style={act.item}>
      <View style={[act.avatarWrap, { backgroundColor: colors.separator.transparent }]}>
        {childEmoji ? (
          <Text style={act.emoji}>{childEmoji}</Text>
        ) : (
          <Ionicons name="person" size={18} color={colors.text.tertiary} />
        )}
      </View>
      <View style={act.info}>
        <Text style={[act.title, { color: colors.text.primary }]}>{childName}</Text>
        <Text style={[act.sub, { color: colors.text.secondary }]}>{deposit.description}</Text>
      </View>
      <TouchableOpacity style={[act.approveBtn, { backgroundColor: colors.separator.transparent }]} onPress={() => approve(deposit.id, '¡Bien hecho!')}>
        <Text style={[act.amount, { color: colors.text.primary }]}>+${deposit.amount.toLocaleString('es-CO')}</Text>
        <Ionicons name="checkmark-circle" size={20} color={colors.system.green} />
      </TouchableOpacity>
    </View>
  );
}

export default function ParentDashboard() {
  const router = useRouter();
  const { parentName } = useParentStore();
  const child = useChildStore();
  const colors = useThemeColors();
  const mode = useThemeStore(s => s.mode);
  const styles = getStyles(colors, mode);

  const [showAssign, setShowAssign] = useState(false);

  // ── Datos Dinámicos del Store ──────────────────────────────────────────────
  const allDeposits = useSavingsStore(s => s.deposits);
  const getTotalSaved = useSavingsStore(s => s.getTotalSaved);
  const allPending = allDeposits.filter(d => d.status === 'pending');

  const totalFamilySaved = child.isOnboarded ? getTotalSaved(child.id) : 0;

  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Header - Estilo Banca Privada */}
        <View style={styles.header}>
          <PageHeader 
            overline="Dashboard"
            title={`Buenos días, ${(parentName || 'Papá/Mamá').split(' ')[0]}`}
            subtitle="Estado financiero de la familia"
            style={{ flex: 1 }}
          />
          <TouchableOpacity style={styles.profileBtn}>
            <View style={styles.avatarPlaceholder}><Ionicons name="person" size={20} color={colors.text.primary} /></View>
          </TouchableOpacity>
        </View>

        {/* Global Wealth Score */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.wealthCard}>
          <View style={styles.wealthHeader}>
            <Text style={styles.wealthLabel}>Capital Familiar</Text>
            <View style={styles.healthBadge}><Text style={styles.healthText}>SALUDABLE</Text></View>
          </View>
          <Text style={styles.wealthValue}>${totalFamilySaved.toLocaleString('es-CO')}</Text>
          <View style={styles.wealthFooter}>
            <Ionicons name="trending-up" size={14} color={colors.system.green} />
            <Text style={styles.wealthTrend}>Ahorro total verificado</Text>
          </View>
        </Animated.View>

        {/* Navegación de Hijos */}
        <View style={styles.childrenNav}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.childrenScroll}>
            {child.isOnboarded && (
              <ChildCard 
                colors={colors}
                styles={styles}
                child={child} 
                isSelected={true} 
                onPress={() => {}}
                pendingCount={allPending.filter(d => d.childId === child.id).length}
              />
            )}
            <TouchableOpacity style={styles.addChild} onPress={() => router.push('/(auth)/onboarding/child-setup')}>
              <Ionicons name="add" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          </ScrollView>
        </View>

        {child.isOnboarded ? (
          <>
            {/* Quick Insights */}
            <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.insightsRow}>
              <View style={styles.insightBox}>
                <Text style={styles.insightLabel}>Pendientes</Text>
                <Text style={styles.insightValue}>{allPending.length}</Text>
              </View>
              <View style={styles.insightBox}>
                <Text style={styles.insightLabel}>Metas Activas</Text>
                <Text style={styles.insightValue}>
                  {useSavingsStore.getState().goals.filter(g => g.childId === child.id).length}
                </Text>
              </View>
            </Animated.View>

            {/* Primary Action Section */}
            <Animated.View entering={FadeInDown.delay(350).springify()} style={styles.actionSection}>
              <TouchableOpacity 
                style={styles.primaryActionBtn} 
                activeOpacity={0.8}
                onPress={() => setShowAssign(true)}
              >
                <View style={styles.actionIconWrap}>
                  <Ionicons name="flag" size={20} color={colors.text.onBrand} />
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={styles.actionTitle}>Asignar Reto de Ahorro</Text>
                  <Text style={styles.actionSub}>Impulsa el hábito de {child.nickname}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.text.onBrand + '50'} />
              </TouchableOpacity>
            </Animated.View>

            {/* Action Required Section */}
            <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.section}>
              <Text style={styles.sectionTitle}>Acción Requerida</Text>
              <View style={styles.activityCard}>
                {allPending.length > 0 ? (
                  allPending.map(d => (
                    <ActivityItem key={d.id} deposit={d} childName={child.nickname} childEmoji={child.avatarEmoji} colors={colors} />
                  ))
                ) : (
                  <View style={styles.emptyActivity}>
                    <Ionicons name="checkmark-circle-outline" size={32} color={colors.system.green} />
                    <Text style={styles.emptyText}>Todo al día por aquí</Text>
                  </View>
                )}
              </View>
            </Animated.View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyStateTitle}>No hay hijos registrados</Text>
            <Text style={styles.emptyStateSub}>Crea un perfil para empezar a gestionar sus finanzas.</Text>
            <CetiButton label="Agregar Hijo" onPress={() => router.push('/(auth)/onboarding/child-setup')} variant="primary" size="medium" style={{ marginTop: 20 }} />
          </View>
        )}

        {/* Shortcut to Analytics */}
        <TouchableOpacity style={styles.analyticsShortcut} onPress={() => router.push('/(parent)/analytics')}>
          <View>
            <Text style={styles.shortcutTitle}>Ver análisis detallado</Text>
            <Text style={styles.shortcutSub}>Tendencias, hábitos y comparativas</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.brand.primary} />
        </TouchableOpacity>

      </ScrollView>

      <AssignGoalModal visible={showAssign} onClose={() => setShowAssign(false)} childId={child.id} childName={child.nickname} colors={colors} />
    </ScreenWrapper>
  );
}

// ── Modal de Retos (Simplificado) ───────────────────────────────────────────
function AssignGoalModal({ visible, onClose, childId, childName, colors }: { visible: boolean; onClose: () => void; childId: string; childName: string; colors: any }) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const addParentGoal = useSavingsStore(s => s.addParentGoal);

  const handle = () => {
    const num = parseInt(amount.replace(/\D/g, ''), 10);
    if (!title.trim() || !num) return Alert.alert('Error', 'Completa los campos');
    addParentGoal(childId, { title: title.trim(), description: '', emoji: '🎯', targetAmount: num, frequency: 'total', category: 'custom' });
    onClose();
    Alert.alert('Reto Creado', `Le hemos enviado la notificación a ${childName}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[modal.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <View style={[modal.sheet, { backgroundColor: colors.background.secondary }]}>
              <Text style={[modal.title, { color: colors.text.primary }]}>Nuevo Reto</Text>
              <TextInput style={[modal.input, { backgroundColor: colors.separator.transparent, color: colors.text.primary, borderColor: colors.materials.border }]} placeholder="¿Qué debe lograr?" placeholderTextColor={colors.text.tertiary} value={title} onChangeText={setTitle} />
              <TextInput style={[modal.input, { backgroundColor: colors.separator.transparent, color: colors.text.primary, borderColor: colors.materials.border }]} placeholder="¿Cuánto debe ahorrar? ($)" placeholderTextColor={colors.text.tertiary} keyboardType="numeric" value={amount} onChangeText={setAmount} />
              <View style={modal.row}>
                <CetiButton label="Cancelar" onPress={onClose} variant="glass" size="medium" style={{ flex: 1 }} />
                <CetiButton label="Crear Reto" onPress={handle} variant="primary" size="medium" style={{ flex: 1 }} />
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (colors: any, mode: string) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.base },
  scroll: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 100, gap: 28 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profileBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.separator.transparent, justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.separator.transparent, justifyContent: 'center', alignItems: 'center' },

  wealthCard: { backgroundColor: colors.materials.base, borderRadius: 32, padding: 24, gap: 12, borderWidth: 1, borderColor: colors.materials.border },
  wealthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wealthLabel: { ...Typography.caption1, color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 1.5 },
  healthBadge: { backgroundColor: colors.system.green + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  healthText: { color: colors.system.green, fontSize: 8, fontWeight: '900' },
  wealthValue: { ...Typography.largeTitle, color: colors.text.primary, fontWeight: '900', fontSize: 36 },
  wealthFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wealthTrend: { color: colors.system.green, fontSize: 10, fontWeight: '700' },

  childrenNav: { marginTop: 8 },
  childrenScroll: { gap: 12 },
  childCardContainer: { width: 70, alignItems: 'center' },
  childCard: { width: 60, height: 80, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  cardTop: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardEmoji: { fontSize: 24 },
  pendingDot: { position: 'absolute', top: -4, right: -4, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  cardName: { ...Typography.caption2, marginTop: 8, fontWeight: '700' },
  addChild: { width: 60, height: 80, borderRadius: 20, backgroundColor: colors.separator.transparent, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.materials.border, justifyContent: 'center', alignItems: 'center' },

  insightsRow: { flexDirection: 'row', gap: 12 },
  insightBox: { flex: 1, backgroundColor: colors.materials.base, borderRadius: 24, padding: 16, gap: 4, borderWidth: 1, borderColor: colors.materials.border },
  insightLabel: { ...Typography.caption2, color: colors.text.secondary },
  insightValue: { ...Typography.title3, color: colors.text.primary, fontWeight: '800' },

  actionSection: { marginTop: 8 },
  primaryActionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.brand.primary, 
    borderRadius: 24, 
    padding: 16, 
    gap: 12,
  },
  actionIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.08)', justifyContent: 'center', alignItems: 'center' },
  actionTextWrap: { flex: 1, gap: 1 },
  actionTitle: { ...Typography.headline, color: colors.text.onBrand, fontWeight: '800', fontSize: 16 },
  actionSub: { ...Typography.caption2, color: colors.text.onBrand + '80', fontWeight: '600' },

  section: { gap: 16 },
  sectionTitle: { ...Typography.headline, color: colors.text.primary, fontWeight: '700' },
  activityCard: { backgroundColor: colors.materials.base, borderRadius: 28, padding: 8 },
  emptyActivity: { padding: 40, alignItems: 'center', gap: 12 },
  emptyText: { ...Typography.caption1, color: colors.text.tertiary },

  analyticsShortcut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.separator.transparent, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.materials.border },
  shortcutTitle: { ...Typography.headline, color: colors.text.primary, fontWeight: '700' },
  shortcutSub: { ...Typography.caption2, color: colors.text.tertiary },

  emptyState: { padding: 40, alignItems: 'center', gap: 12, backgroundColor: colors.materials.base, borderRadius: 32, borderWidth: 1, borderColor: colors.materials.border },
  emptyStateTitle: { ...Typography.title3, color: colors.text.primary, fontWeight: '800' },
  emptyStateSub: { ...Typography.body, color: colors.text.secondary, textAlign: 'center' },
});

const act = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20 },
  avatarWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 24 },
  info: { flex: 1, gap: 2 },
  title: { ...Typography.headline, fontSize: 14 },
  sub: { ...Typography.caption2 },
  approveBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  amount: { ...Typography.headline, fontWeight: '800', fontSize: 13 },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, gap: 16, paddingBottom: 48 },
  title: { ...Typography.title2, fontWeight: '800', marginBottom: 8 },
  input: { borderRadius: 20, padding: 20, ...Typography.body, borderWidth: 1 },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
});
