// app/(parent)/analytics.tsx — Análisis Avanzado para Padres (Sin Mocks)
import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@shared/constants/typography';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useLessonsStore } from '@features/learning/store/useLessonsStore';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';
import { useChildStore } from '@features/auth/store/useChildStore';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';

const { width } = Dimensions.get('window');

// ── Tarjeta de Métrica Clave ────────────────────────────────────────────────
function MetricCard({ title, value, sub, trend, color, colors, styles }: { title: string; value: string; sub: string; trend: string; color: string; colors: any; styles: any }) {
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.materials.base, borderColor: colors.materials.border }]}>
      <Text style={[styles.metricTitle, { color: colors.text.secondary }]}>{title}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <View style={styles.trendRow}>
        <Ionicons name="trending-up" size={14} color={colors.system.green} />
        <Text style={[styles.trendText, { color: colors.system.green }]}>{trend} este mes</Text>
      </View>
      <Text style={[styles.metricSub, { color: colors.text.tertiary }]}>{sub}</Text>
    </View>
  );
}

// ── Gráfica de Barras Pro ─────────────────────────────────────────
function AdvancedBarChart({ data, color, labels, colors }: { data: number[]; color: string; labels: string[]; colors: any }) {
  const max = Math.max(...data, 1);
  return (
    <View style={chart.container}>
      {data.map((v, i) => (
        <View key={i} style={chart.col}>
          <View style={[chart.barWrap, { backgroundColor: colors.separator.transparent }]}>
            <View style={[chart.bar, { height: `${(v / max) * 100}%` as any, backgroundColor: color }]} />
          </View>
          <Text style={[chart.label, { color: colors.text.tertiary }]}>{labels[i]}</Text>
        </View>
      ))}
      {data.length === 0 && <Text style={{ color: colors.text.tertiary, ...Typography.caption2 }}>Sin datos</Text>}
    </View>
  );
}

export default function AnalyticsScreen() {
  const child = useChildStore();
  const colors = useThemeColors();
  const mode = useThemeStore(s => s.mode);
  const styles = getStyles(colors, mode);

  const [activeTab, setActiveTab] = useState('savings'); 
  const [showHabitDetail, setShowHabitDetail] = useState(false);

  // ── Datos Dinámicos del Store ──────────────────────────────────────────────
  const allDeposits = useSavingsStore(s => s.deposits);
  const getTotalSaved = useSavingsStore(s => s.getTotalSaved);
  const completedLessons = useLessonsStore(s => s.completedLessons);

  const totalFamilySaved = child.isOnboarded ? getTotalSaved(child.id) : 0;
  
  const approvedDeposits = allDeposits.filter(d => d.status === 'approved');
  const avgSavingRate = approvedDeposits.length > 0 
    ? (approvedDeposits.reduce((a, b) => a + b.amount, 0) / 30).toLocaleString('es-CO', { maximumFractionDigits: 0 })
    : '0';

  const filteredHabits = useMemo(() => {
    return getDetectedHabits(child, allDeposits, completedLessons);
  }, [child, allDeposits, completedLessons]);

  if (!child.isOnboarded) {
    return (
      <ScreenWrapper style={styles.root}>
        <PageHeader title="Analytics" subtitle="Analizando nuevos datos..." />
        <View style={styles.emptyCenter}>
          <Ionicons name="bar-chart-outline" size={64} color={colors.text.tertiary} />
          <Text style={styles.emptyTitle}>Esperando datos familiares</Text>
          <Text style={styles.emptySub}>Registra un hijo para ver métricas avanzadas.</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        <PageHeader 
          overline="Insights"
          title="Centro de Datos"
          subtitle={`Análisis de ${child.nickname}`}
        />

        {/* Switch de Categoría */}
        <View style={styles.tabs}>
          <TouchableOpacity onPress={() => setActiveTab('savings')} style={[styles.tab, activeTab === 'savings' && styles.tabActive]}>
            <Text style={[styles.tabText, activeTab === 'savings' && styles.tabTextActive]}>Ahorros</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('learning')} style={[styles.tab, activeTab === 'learning' && styles.tabActive]}>
            <Text style={[styles.tabText, activeTab === 'learning' && styles.tabTextActive]}>Educación</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'savings' ? (
          <View style={{ gap: 28 }}>
            <View style={styles.metricsGrid}>
              <MetricCard 
                colors={colors}
                styles={styles}
                title="Ahorro Promedio" 
                value={`$${avgSavingRate}`} 
                sub="Basado en depósitos" 
                trend="+0%" 
                color={colors.brand.primary} 
              />
              <MetricCard 
                colors={colors}
                styles={styles}
                title="Ahorro Total" 
                value={`$${totalFamilySaved.toLocaleString('es-CO')}`} 
                sub="Capital verificado" 
                trend="+0%" 
                color={colors.system.blue} 
              />
            </View>

            <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.chartSection}>
              <Text style={styles.sectionTitle}>Historial de Ahorro</Text>
              <View style={styles.chartCard}>
                <AdvancedBarChart 
                  data={child.savingsHistory.length > 0 ? child.savingsHistory : [0,0,0,0,0,0,0,0]} 
                  color={colors.brand.primary} 
                  labels={['S-7', 'S-6', 'S-5', 'S-4', 'S-3', 'S-2', 'S-1', 'Hoy']} 
                  colors={colors}
                />
              </View>
            </Animated.View>
          </View>
        ) : (
          <View style={{ gap: 28 }}>
            <View style={styles.metricsGrid}>
              <MetricCard 
                colors={colors}
                styles={styles}
                title="Precisión" 
                value={`${child.accuracy}%`} 
                sub="Promedio en quizzes" 
                trend="+0%" 
                color={colors.system.green} 
              />
              <MetricCard 
                colors={colors}
                styles={styles}
                title="Lecciones" 
                value={completedLessons.filter(l => l.childId === child.id).length.toString()} 
                sub="Completadas" 
                trend="+0" 
                color={colors.system.purple} 
              />
            </View>

            <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.chartSection}>
              <Text style={styles.sectionTitle}>Desempeño Educativo</Text>
              <View style={styles.chartCard}>
                <AdvancedBarChart 
                  data={child.educationHistory.length > 0 ? child.educationHistory : [0,0,0,0,0,0,0,0]} 
                  color={colors.system.purple} 
                  labels={['S-7', 'S-6', 'S-5', 'S-4', 'S-3', 'S-2', 'S-1', 'Hoy']} 
                  colors={colors}
                />
              </View>
            </Animated.View>
          </View>
        )}

        {/* Hábitos Detectados */}
        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Hábitos Detectados</Text>
          <View style={styles.habitList}>
            {filteredHabits.map((h, i) => (
              <Animated.View key={h.title + i} entering={FadeInDown.delay(450 + i * 50)} style={[styles.habitItem, { backgroundColor: colors.materials.base }]}>
                <View style={[styles.habitIcon, { backgroundColor: h.color + '15' }]}>
                  <Ionicons name={h.icon as any} size={20} color={h.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.habitTitle, { color: colors.text.primary }]}>{h.title}</Text>
                  <Text style={[styles.habitDesc, { color: colors.text.secondary }]}>{h.desc}</Text>
                </View>
                <Text style={[styles.habitScore, { color: h.color }]}>{h.score}</Text>
              </Animated.View>
            ))}
            {filteredHabits.length === 0 && (
              <View style={styles.emptyHabits}>
                <Ionicons name="analytics" size={32} color={colors.text.tertiary + '20'} />
                <Text style={styles.emptyHabitsText}>Analizando patrones de ahorro...</Text>
              </View>
            )}
          </View>
        </Animated.View>

        <TouchableOpacity style={styles.reportBtn}>
          <Ionicons name="document-text-outline" size={20} color={colors.text.onBrand} />
          <Text style={styles.reportText}>Generar Reporte PDF</Text>
        </TouchableOpacity>

      </ScrollView>

      <HabitDetailModal 
        visible={showHabitDetail} 
        onClose={() => setShowHabitDetail(false)} 
        habits={filteredHabits}
        childName={child.nickname}
        colors={colors}
        styles={styles}
      />
    </ScreenWrapper>
  );
}

// ── LÓGICA DE DETECCIÓN DE HÁBITOS ──────────────────────────────────────────
function getDetectedHabits(child: any, deposits: any[], lessons: any[]) {
  const habits = [];
  if (!child.isOnboarded) return [];

  // Ejemplo de lógica dinámica simple
  if (deposits.length > 3) {
    habits.push({ title: 'Ahorrador Constante', desc: `${child.nickname} mantiene un ritmo de ahorro activo.`, icon: 'calendar', color: '#10B981', score: '9.0' });
  }
  if (child.accuracy > 80) {
    habits.push({ title: 'Maestro del Quiz', desc: 'Excelente retención de conceptos financieros.', icon: 'school', color: '#8B5CF6', score: '9.5' });
  }
  
  return habits;
}

// ── MODAL DETALLADO DE HÁBITOS ──────────────────────────────────────────────
function HabitDetailModal({ visible, onClose, habits, childName, colors, styles }: { visible: boolean; onClose: () => void; habits: any[]; childName: string; colors: any; styles: any }) {
  const [activeTab, setActiveTab] = useState<'detected' | 'glossary'>('detected');

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[modalStyles.overlay, { backgroundColor: colors.background.base }]}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <TouchableOpacity onPress={onClose} style={[modalStyles.backBtn, { backgroundColor: colors.separator.transparent }]}>
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={[modalStyles.title, { color: colors.text.primary }]}>Hábitos de {childName}</Text>
          </View>

          <View style={[modalStyles.tabs, { backgroundColor: colors.separator.transparent }]}>
            <TouchableOpacity onPress={() => setActiveTab('detected')} style={[modalStyles.tab, activeTab === 'detected' && { backgroundColor: colors.materials.base }]}>
              <Text style={[modalStyles.tabText, { color: colors.text.tertiary }, activeTab === 'detected' && { color: colors.text.primary }]}>Hábitos detectados</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveTab('glossary')} style={[modalStyles.tab, activeTab === 'glossary' && { backgroundColor: colors.materials.base }]}>
              <Text style={[modalStyles.tabText, { color: colors.text.tertiary }, activeTab === 'glossary' && { color: colors.text.primary }]}>Sobre los hábitos</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={modalStyles.scroll}>
            {activeTab === 'detected' ? (
              <View style={{ gap: 12 }}>
                {habits.map((h, i) => (
                  <View key={h.title + i} style={[styles.habitItem, { backgroundColor: colors.materials.base }]}>
                    <View style={[styles.habitIcon, { backgroundColor: h.color + '15' }]}>
                      <Ionicons name={h.icon as any} size={20} color={h.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.habitTitle, { color: colors.text.primary }]}>{h.title}</Text>
                      <Text style={[styles.habitDesc, { color: colors.text.secondary }]}>{h.desc}</Text>
                    </View>
                    <Text style={[styles.habitScore, { color: h.color }]}>{h.score}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ gap: 24 }}>
                <Text style={[modalStyles.intro, { color: colors.text.secondary }]}>
                  Nuestro algoritmo analiza el comportamiento financiero para identificar fortalezas y áreas de mejora.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any, mode: string) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.base },
  scroll: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 120, gap: 28 },
  
  tabs: { flexDirection: 'row', backgroundColor: colors.separator.transparent, borderRadius: 16, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: colors.materials.base },
  tabText: { ...Typography.caption1, color: colors.text.tertiary, fontWeight: '700' },
  tabTextActive: { color: colors.text.primary },

  metricsGrid: { flexDirection: 'row', gap: 12 },
  metricCard: { flex: 1, borderRadius: 24, padding: 16, gap: 8, borderWidth: 1 },
  metricTitle: { ...Typography.caption2, textTransform: 'uppercase', letterSpacing: 1 },
  metricValue: { ...Typography.title2, fontWeight: '900' },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trendText: { fontSize: 10, fontWeight: '700' },
  metricSub: { ...Typography.caption2 },

  chartSection: { gap: 16 },
  sectionTitle: { ...Typography.headline, color: colors.text.primary, fontWeight: '700' },
  chartCard: { backgroundColor: colors.materials.base, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: colors.materials.border },

  section: { gap: 16 },
  habitList: { gap: 12 },
  habitItem: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 16, gap: 16 },
  habitIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  habitTitle: { ...Typography.headline, fontSize: 14 },
  habitDesc: { ...Typography.caption2 },
  habitScore: { ...Typography.caption1, fontWeight: '800' },

  emptyHabits: { padding: 40, alignItems: 'center', gap: 12, backgroundColor: colors.materials.base, borderRadius: 20 },
  emptyHabitsText: { ...Typography.caption1, color: colors.text.tertiary, fontWeight: '600' },

  reportBtn: { height: 56, backgroundColor: colors.brand.primary, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 },
  reportText: { ...Typography.headline, color: colors.text.onBrand, fontWeight: '800' },

  emptyCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 16 },
  emptyTitle: { ...Typography.title3, color: colors.text.primary, fontWeight: '800' },
  emptySub: { ...Typography.body, color: colors.text.secondary, textAlign: 'center' },
});

const chart = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 120, gap: 10 },
  col: { alignItems: 'center', gap: 8, flex: 1 },
  barWrap: { width: 24, height: 100, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 6 },
  label: { fontSize: 10, fontWeight: '700' },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1 },
  container: { flex: 1, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20, gap: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  title: { ...Typography.title3, fontWeight: '800' },
  tabs: { flexDirection: 'row', marginHorizontal: 20, borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabText: { ...Typography.caption2, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 24 },
  intro: { ...Typography.body, lineHeight: 22 },
});
