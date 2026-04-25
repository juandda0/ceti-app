// app/(child)/learn.tsx — Camino de Aprendizaje Dinámico para Niños
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@shared/constants/colors';
import { Typography } from '@shared/constants/typography';
import { LESSONS } from '@features/learning/data/lessons';
import { useLessonsStore } from '@features/learning/store/useLessonsStore';
import ScreenWrapper from '@shared/components/ScreenWrapper';

import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';

export default function LearnScreen() {
  const router = useRouter();
  const completedLessons = useLessonsStore((s) => s.completedLessons);
  const colors = useThemeColors();
  const mode = useThemeStore(s => s.mode);
  const styles = getStyles(colors, mode);

  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Header Dinámico */}
        <Animated.View entering={FadeIn.delay(100)} style={styles.header}>
          <View>
            <Text style={styles.greeting}>Aprender</Text>
            <Text style={styles.welcome}>¡Conviértete en un experto!</Text>
          </View>
          <View style={styles.progressBadge}>
            <Text style={styles.progressText}>{completedLessons.length}/{LESSONS.length}</Text>
          </View>
        </Animated.View>

        {/* Camino de Lecciones (Diseño de tarjetas más visuales) */}
        <View style={styles.path}>
          {LESSONS.map((lesson, i) => {
            const isCompleted = completedLessons.some(c => c.lessonId === lesson.id);
            const isLocked = i > 0 && !completedLessons.some(c => c.lessonId === LESSONS[i - 1].id);
            const isNext = !isCompleted && !isLocked;
            
            return (
              <Animated.View key={lesson.id} entering={FadeInDown.delay(200 + i * 80).springify()}>
                <TouchableOpacity 
                  activeOpacity={isLocked ? 1 : 0.7} 
                  onPress={() => !isLocked && router.push(`/lesson/${lesson.id}`)}
                  style={[
                    styles.lessonCard, 
                    isLocked && styles.lessonCardLocked,
                    isNext && styles.lessonCardNext
                  ]}
                >
                  <View style={[styles.iconWrap, { backgroundColor: isLocked ? colors.separator.transparent : lesson.color + '15' }]}>
                    <Ionicons 
                      name={isCompleted ? 'checkmark-circle' : isLocked ? 'lock-closed' : lesson.icon as any} 
                      size={24} 
                      color={isCompleted ? colors.system.green : isLocked ? colors.text.tertiary : lesson.color} 
                    />
                  </View>
                  
                  <View style={styles.lessonInfo}>
                    <Text style={[styles.lessonTitle, isLocked && styles.lockedText]}>{lesson.title}</Text>
                    <View style={styles.rewardRow}>
                      <View style={styles.rewardPill}>
                        <Ionicons name="sparkles" size={10} color={colors.brand.primary} />
                        <Text style={styles.rewardText}>+{lesson.xpReward} XP</Text>
                      </View>
                      <View style={styles.rewardPill}>
                        <Ionicons name="cash" size={10} color={colors.gold.primary} />
                        <Text style={[styles.rewardText, { color: colors.gold.primary }]}>+{lesson.cetisReward} CETI</Text>
                      </View>
                    </View>
                  </View>

                  {!isLocked && !isCompleted && (
                    <View style={styles.playBtn}>
                      <Ionicons name="play" size={16} color={colors.text.onBrand} />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Conector visual entre lecciones */}
                {i < LESSONS.length - 1 && (
                  <View style={styles.connectorContainer}>
                    <View style={[styles.connector, isCompleted && { backgroundColor: colors.system.green + '40' }]} />
                  </View>
                )}
              </Animated.View>
            );
          })}
        </View>

      </ScrollView>
    </ScreenWrapper>
  );
}

const getStyles = (colors: any, mode: string) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.base },
  scroll: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 120, gap: 24 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  greeting: { ...Typography.title2, color: colors.text.primary, fontWeight: '800' },
  welcome: { ...Typography.subheadline, color: colors.text.secondary },
  progressBadge: { backgroundColor: colors.brand.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  progressText: { color: colors.text.onBrand, fontWeight: '900', fontSize: 12 },

  path: { gap: 0 },
  lessonCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.materials.base, 
    borderRadius: 28, 
    padding: 16, 
    gap: 16, 
    borderWidth: 1, 
    borderColor: colors.materials.border 
  },
  lessonCardNext: { 
    borderColor: colors.brand.primary + '40', 
    backgroundColor: colors.brand.primary + (mode === 'light' ? '10' : '05'), 
    borderWidth: 2 
  },
  lessonCardLocked: { opacity: 0.6 },
  
  iconWrap: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  lessonInfo: { flex: 1, gap: 8 },
  lessonTitle: { ...Typography.headline, color: colors.text.primary, fontWeight: '800', fontSize: 17 },
  lockedText: { color: colors.text.tertiary },
  
  rewardRow: { flexDirection: 'row', gap: 8 },
  rewardPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    backgroundColor: colors.separator.transparent, 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  rewardText: { color: colors.brand.primary, fontSize: 10, fontWeight: '800' },

  playBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand.primary, justifyContent: 'center', alignItems: 'center' },

  connectorContainer: { alignItems: 'center', height: 24, justifyContent: 'center' },
  connector: { width: 4, height: '100%', backgroundColor: colors.separator.transparent, borderRadius: 2 },
});
