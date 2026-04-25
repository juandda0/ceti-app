// app/(parent)/tasks.tsx — Gestión de Tareas Ejecutiva
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Typography } from '@shared/constants/typography';
import { useParentStore, TaskFrequency } from '@features/family/store/useParentStore';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import { useChildStore } from '@features/auth/store/useChildStore';
import CetiButton from '@shared/components/CetiButton';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';

export default function TasksScreen() {
  const { tasks, addTask, completeTask, removeTask } = useParentStore();
  const earnCetis = useWalletStore((s) => s.earnCetis);
  const addXP = useChildStore((s) => s.addXP);
  const colors = useThemeColors();
  const mode = useThemeStore(s => s.mode);
  const styles = getStyles(colors, mode);

  const [showForm, setShowForm] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [reward, setReward] = useState('10');
  const [frequency, setFrequency] = useState<TaskFrequency>('once');

  const pendingTasks = tasks.filter((t) => !t.isCompleted);
  const completedTasks = tasks.filter((t) => t.isCompleted);

  const handleAddTask = () => {
    if (taskName.trim().length < 2) return;
    addTask(taskName.trim(), parseInt(reward) || 10, frequency);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTaskName('');
    setShowForm(false);
  };

  const handleComplete = (taskId: string) => {
    const task = completeTask(taskId);
    if (task) {
      earnCetis(task.cetisReward, task.name, 'task');
      addXP(25);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <PageHeader 
            overline="Economía"
            title="Tareas Familiares"
            subtitle="Asigna responsabilidades y recompensas"
            style={{ flex: 1 }}
          />
          <TouchableOpacity 
            style={[styles.addBtn, showForm && { backgroundColor: colors.system.red + '15' }]} 
            onPress={() => setShowForm(!showForm)}
          >
            <Ionicons name={showForm ? 'close' : 'add'} size={24} color={showForm ? colors.system.red : colors.brand.primary} />
          </TouchableOpacity>
        </View>

        {showForm && (
          <Animated.View entering={FadeInDown.springify()} style={styles.formCard}>
            <Text style={styles.formLabel}>¿Qué debe hacer?</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Ej: Lavar los platos" 
              placeholderTextColor={colors.text.tertiary}
              value={taskName}
              onChangeText={setTaskName}
            />
            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Cetis</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  value={reward}
                  onChangeText={setReward}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.formLabel}>Frecuencia</Text>
                <View style={styles.freqRow}>
                  {['once', 'daily', 'weekly'].map((f) => (
                    <TouchableOpacity 
                      key={f} 
                      onPress={() => setFrequency(f as any)}
                      style={[styles.freqBtn, frequency === f && styles.freqBtnActive]}
                    >
                      <Text style={[styles.freqText, frequency === f && styles.freqTextActive]}>
                        {f === 'once' ? '1 vez' : f === 'daily' ? 'Día' : 'Sem'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <CetiButton label="Crear Tarea" onPress={handleAddTask} variant="primary" size="medium" />
          </Animated.View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pendientes ({pendingTasks.length})</Text>
          <View style={styles.taskList}>
            {pendingTasks.map((t) => (
              <View key={t.id} style={styles.taskItem}>
                <View style={styles.taskIcon}><Ionicons name="clipboard-outline" size={20} color={colors.brand.primary} /></View>
                <View style={styles.taskInfo}>
                  <Text style={styles.taskName}>{t.name}</Text>
                  <Text style={styles.taskSub}>{t.frequency === 'once' ? 'Una vez' : t.frequency === 'daily' ? 'Diaria' : 'Semanal'}</Text>
                </View>
                <View style={styles.taskRight}>
                  <Text style={styles.taskReward}>+{t.cetisReward} C</Text>
                  <TouchableOpacity style={styles.checkBtn} onPress={() => handleComplete(t.id)}>
                    <Ionicons name="checkmark" size={16} color={colors.text.onBrand} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {pendingTasks.length === 0 && (
              <Text style={{ textAlign: 'center', padding: 20, color: colors.text.tertiary, ...Typography.caption1 }}>No hay tareas pendientes</Text>
            )}
          </View>
        </View>

        {completedTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completadas</Text>
            <View style={styles.taskList}>
              {completedTasks.slice(0, 5).map((t) => (
                <View key={t.id} style={[styles.taskItem, { opacity: 0.5 }]}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.system.green} />
                  <Text style={[styles.taskName, { flex: 1, textDecorationLine: 'line-through', color: colors.text.primary }]}>{t.name}</Text>
                  <TouchableOpacity onPress={() => removeTask(t.id)}>
                    <Ionicons name="trash-outline" size={18} color={colors.text.tertiary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

      </ScrollView>
    </ScreenWrapper>
  );
}

const getStyles = (colors: any, mode: string) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.base },
  scroll: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 120, gap: 28 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addBtn: { 
    width: 44, height: 44, 
    borderRadius: 22, 
    backgroundColor: colors.separator.transparent, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  formCard: { 
    backgroundColor: colors.materials.base, 
    borderRadius: 24, 
    padding: 20, 
    gap: 12, 
    borderWidth: 1, 
    borderColor: colors.materials.border 
  },
  formLabel: { ...Typography.caption2, color: colors.text.tertiary, textTransform: 'uppercase', letterSpacing: 1 },
  input: { 
    backgroundColor: colors.separator.transparent, 
    borderRadius: 12, 
    padding: 12, 
    color: colors.text.primary, 
    ...Typography.body,
    borderWidth: 1,
    borderColor: colors.materials.border
  },
  formRow: { flexDirection: 'row', gap: 12 },
  freqRow: { flexDirection: 'row', gap: 6 },
  freqBtn: { flex: 1, height: 44, borderRadius: 10, backgroundColor: colors.separator.transparent, justifyContent: 'center', alignItems: 'center' },
  freqBtnActive: { backgroundColor: colors.brand.primary },
  freqText: { color: colors.text.tertiary, fontSize: 10, fontWeight: '700' },
  freqTextActive: { color: colors.text.onBrand },

  section: { gap: 12 },
  sectionTitle: { ...Typography.headline, color: colors.text.primary, fontWeight: '700' },
  taskList: { backgroundColor: colors.materials.base, borderRadius: 24, padding: 8, borderWidth: 1, borderColor: colors.materials.border },
  taskItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16 },
  taskIcon: { 
    width: 40, height: 40, 
    borderRadius: 12, 
    backgroundColor: colors.brand.primary + '10', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  taskInfo: { flex: 1, gap: 2 },
  taskName: { ...Typography.headline, color: colors.text.primary, fontSize: 14 },
  taskSub: { ...Typography.caption2, color: colors.text.tertiary },
  taskRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  taskReward: { ...Typography.headline, color: colors.gold.primary, fontWeight: '800', fontSize: 13 },
  checkBtn: { 
    width: 32, height: 32, 
    borderRadius: 16, 
    backgroundColor: colors.brand.primary, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
});
