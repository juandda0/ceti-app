import { useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { LESSONS, Lesson } from '@features/learning/data/lessons';
import { LEARN_UNITS } from '@features/learning/data/learnUnits';
import { useLessonsStore } from '@features/learning/store/useLessonsStore';
import { useChildStore } from '@features/auth/store/useChildStore';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import LessonPathNode, { LessonNodeStatus } from './LessonPathNode';
import LessonStartConfirmSheet from './LessonStartConfirmSheet';

/** Serpenteo horizontal (misma logica que Biomech / Duolingo). */
export function getSagaPathOffset(index: number): number {
  const position = (index % 8) + 1;
  switch (position) {
    case 1:
    case 5:
      return 0;
    case 2:
    case 4:
      return -40;
    case 3:
      return -58;
    case 6:
    case 8:
      return 40;
    case 7:
      return 58;
    default:
      return 0;
  }
}

function lessonStatus(
  lesson: Lesson,
  index: number,
  completedLessonIds: Set<string>
): LessonNodeStatus {
  const completed = completedLessonIds.has(lesson.id);
  if (completed) return 'completed';

  const prev = index > 0 ? LESSONS[index - 1] : null;
  const locked = prev != null && !completedLessonIds.has(prev.id);
  if (locked) return 'locked';

  return 'current';
}

type ConfirmState = {
  lesson: Lesson;
  index: number;
};

interface LessonSagaMapProps {
  activeUnitId?: string;
  onUnitLayout?: (unitId: string, y: number) => void;
  onSectionBottomLayout?: (unitId: string, bottomY: number) => void;
}

export default function LessonSagaMap({
  activeUnitId,
  onUnitLayout,
  onSectionBottomLayout,
}: LessonSagaMapProps) {
  const router = useRouter();
  const completedLessons = useLessonsStore((s) => s.completedLessons);
  const activeChildId = useChildStore((s) => s.id);
  const colors = useThemeColors();
  const completedIds = new Set(
    completedLessons
      .filter((c) => (activeChildId ? c.childId === activeChildId : true))
      .map((c) => c.lessonId)
  );
  const unitTopByIdRef = useRef<Record<string, number>>({});

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const openConfirm = (lesson: Lesson, index: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirm({ lesson, index });
  };

  const closeConfirm = () => setConfirm(null);

  const handleConfirmStart = () => {
    if (!confirm) return;
    router.push(`/lesson/${confirm.lesson.id}`);
    setConfirm(null);
  };

  return (
    <View style={[styles.mapWrap, { backgroundColor: colors.background.base }]}>
      {LEARN_UNITS.map((unit, unitIndex) => {
        const unitLessons = LESSONS.slice(unit.lessonRange.start, unit.lessonRange.end + 1);

        return (
          <View
            key={unit.id}
            style={styles.unitBlock}
            onLayout={(e) => {
              const y = e.nativeEvent.layout.y;
              unitTopByIdRef.current[unit.id] = y;
              onUnitLayout?.(unit.id, y);
            }}
          >
            {unitIndex > 0 ? (
              <View style={styles.separatorWrap}>
                <View
                  style={[styles.separatorLine, { backgroundColor: colors.separator.opaque }]}
                />
              </View>
            ) : null}

            <View
              style={[
                styles.sectionHeaderCard,
                {
                  borderColor: colors.materials.border,
                  backgroundColor: colors.materials.base,
                },
              ]}
              onLayout={(e) => {
                const localY = e.nativeEvent.layout.y;
                const h = e.nativeEvent.layout.height;
                const unitTop = unitTopByIdRef.current[unit.id] ?? 0;
                onSectionBottomLayout?.(unit.id, unitTop + localY + h);
              }}
            >
              <Text style={[styles.sectionHeaderTitle, { color: colors.text.primary }]}>
                {unit.title}
              </Text>
            </View>

            {unitLessons.map((lesson, localIndex) => {
              const index = unit.lessonRange.start + localIndex;
              const status = lessonStatus(lesson, index, completedIds);
              const iconName = (
                status === 'locked' ? 'lock-closed' : lesson.icon
              ) as keyof typeof Ionicons.glyphMap;

              return (
                <View key={lesson.id} style={styles.row}>
                  <LessonPathNode
                    status={status}
                    iconName={iconName}
                    accentColor={lesson.color}
                    translateX={getSagaPathOffset(index)}
                    colors={colors}
                    onPress={() => {
                      if (status !== 'locked') {
                        openConfirm(lesson, index);
                      }
                    }}
                  />
                </View>
              );
            })}
          </View>
        );
      })}

      {confirm ? (
        <LessonStartConfirmSheet
          visible
          lesson={confirm.lesson}
          lessonIndex={confirm.index}
          isReplay={completedIds.has(confirm.lesson.id)}
          onClose={closeConfirm}
          onConfirm={handleConfirmStart}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 28,
    paddingHorizontal: 0,
  },
  unitBlock: {
    marginBottom: 14,
  },
  separatorWrap: {
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 8,
  },
  separatorLine: {
    width: '82%',
    height: 1,
    borderRadius: 1,
  },
  sectionHeaderCard: {
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: 220,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  row: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    minHeight: 88,
  },
});
