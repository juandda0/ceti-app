// app/(child)/learn.tsx — Mapa saga con header sticky dinamico por seccion
import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
} from 'react-native';
import { LESSONS } from '@features/learning/data/lessons';
import { LEARN_UNITS } from '@features/learning/data/learnUnits';
import { useLessonsStore } from '@features/learning/store/useLessonsStore';
import LessonSagaMap from '@features/learning/components/saga/LessonSagaMap';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChildStore } from '@features/auth/store/useChildStore';

export default function LearnScreen() {
  const childId = useChildStore((s) => s.id);
  const completedLessons = useLessonsStore((s) => s.completedLessons);
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const done = useMemo(
    () => completedLessons.filter((p) => p.childId === childId).length,
    [completedLessons, childId]
  );
  const total = LESSONS.length;
  const [activeUnitId, setActiveUnitId] = useState<string>(LEARN_UNITS[0].id);
  const [sectionBottoms, setSectionBottoms] = useState<Record<string, number>>({});

  const activeUnit = useMemo(
    () => LEARN_UNITS.find((u) => u.id === activeUnitId) ?? LEARN_UNITS[0],
    [activeUnitId]
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const triggerY = e.nativeEvent.contentOffset.y;
    const measuredUnits = LEARN_UNITS.filter((u) => sectionBottoms[u.id] != null);
    if (measuredUnits.length === 0) return;

    let candidate: string = LEARN_UNITS[0].id;
    for (const unit of measuredUnits) {
      const bottomY = sectionBottoms[unit.id] ?? Number.POSITIVE_INFINITY;
      if (triggerY >= bottomY - 1) {
        candidate = unit.id;
      }
    }

    if (candidate !== activeUnitId) {
      setActiveUnitId(candidate);
    }
  };

  return (
    <ScreenWrapper style={[styles.root, { backgroundColor: colors.background.base }]}>
      <View
        style={[
          styles.stickyHeader,
          {
            backgroundColor: colors.brand.primary,
            paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 8) + 8,
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <View style={[styles.progressChip, { backgroundColor: colors.brand.chipBackdrop }]}>
            <Text
              style={[styles.progressChipText, { color: colors.text.onBrand }]}
            >{`${done}/${total}`}</Text>
          </View>
        </View>

        <Text style={[styles.kicker, { color: colors.brand.bandSubtitle }]}>Tu camino</Text>
        <Text style={[styles.title, { color: colors.text.onBrand }]}>{activeUnit.title}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces
        onScroll={onScroll}
        scrollEventThrottle={1}
      >
        <View style={[styles.contentShell, { backgroundColor: colors.background.base }]}>
          <LessonSagaMap
            activeUnitId={activeUnitId}
            onSectionBottomLayout={(unitId, bottomY) => {
              setSectionBottoms((prev) =>
                prev[unitId] === bottomY ? prev : { ...prev, [unitId]: bottomY }
              );
            }}
          />
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stickyHeader: {
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  headerTopRow: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  progressChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  progressChipText: {
    fontSize: 13,
    fontWeight: '900',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  scroll: {
    paddingBottom: 140,
    paddingHorizontal: 0,
  },
  contentShell: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -6,
    paddingTop: 18,
    paddingBottom: 12,
    minHeight: 120,
    paddingHorizontal: 6,
  },
});
