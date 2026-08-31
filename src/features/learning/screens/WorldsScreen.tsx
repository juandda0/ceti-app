import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import {
  useQuestionBankStore,
  QUESTIONS_PER_WORLD,
} from '@features/learning/store/useQuestionBankStore';
import type { WorldId } from '@features/learning/data/quiz.types';
import { worldProgressRepository } from '@features/dashboard/data/worldProgressRepository';
import { useStudentGrado } from '@features/learning/hooks/useStudentGrado';
import { useClassConfig } from '@features/learning/hooks/useClassConfig';
import { resolveClassWorlds } from '@features/learning/data/classConfig';
import {
  COMPETENCIA_PERSONALIZADA,
  competenciaForWorld,
  competenciaLabel,
} from '@features/learning/data/competencias';
import { worldStatus } from '@features/learning/data/worldStatus';
import StudentAssignmentsBanner from '@features/dashboard/components/StudentAssignmentsBanner';
import AuthorizationPendingBanner from '@features/dashboard/components/AuthorizationPendingBanner';
import ClassCodeForm from '@features/dashboard/components/ClassCodeForm';
import { joinClass } from '@features/dashboard/data/joinClass';
import { hasClassAccess } from '@features/learning/data/classAccess';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import { Spacing, BorderRadius } from '@shared/constants/theme';
import { motion } from '@shared/constants/motion';
import type { ThemeColors } from '@shared/constants/colors';
import { displayWorldDef, type WorldDef } from '@features/learning/data/worldMeta';

function WorldCard({
  world,
  competenciaLabel,
  progress,
  isUnlocked,
  prevWorldName,
  index,
  isLast,
  colors,
  onPress,
  t,
}: {
  world: WorldDef;
  competenciaLabel: string;
  progress: number;
  isUnlocked: boolean;
  /** Name of the previous world in the CLASS order (drives the locked note). */
  prevWorldName?: string;
  index: number;
  isLast: boolean;
  colors: ThemeColors;
  onPress: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const done = Math.round(progress * QUESTIONS_PER_WORLD);
  const pct = Math.min(Math.round(progress * 100), 100);
  const status = worldStatus(isUnlocked, progress);

  return (
    <Animated.View entering={motion.enterDown(index * 45)} style={cardSt.row}>
      <View style={cardSt.rail} pointerEvents="none">
        <View
          style={[
            cardSt.railLine,
            {
              top: index === 0 ? Spacing.lg + 12 : 0,
              bottom: isLast ? undefined : 0,
              height: isLast ? Spacing.lg + 12 : undefined,
              backgroundColor: colors.materials.border,
            },
          ]}
        />
        <View
          style={[
            cardSt.node,
            {
              backgroundColor: isUnlocked ? colors.background.primary : colors.background.secondary,
              borderColor: isUnlocked ? world.color : colors.materials.border,
            },
          ]}
        >
          <Ionicons
            name={status === 'dominado' ? 'checkmark' : isUnlocked ? 'ellipse' : 'lock-closed'}
            size={status === 'dominado' ? 14 : isUnlocked ? 8 : 12}
            color={isUnlocked ? world.color : colors.text.quaternary}
          />
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={isUnlocked ? 0.82 : 1}
        onPress={isUnlocked ? onPress : undefined}
        accessibilityRole="button"
        accessibilityLabel={t('worlds.openWorld', { n: world.number })}
        accessibilityState={{ disabled: !isUnlocked }}
        style={[
          cardSt.card,
          {
            backgroundColor: colors.background.primary,
            borderColor: colors.materials.border,
            opacity: isUnlocked ? 1 : 0.62,
          },
        ]}
      >
        <View
          style={[
            cardSt.iconWrap,
            {
              backgroundColor: isUnlocked ? `${world.color}14` : colors.background.secondary,
            },
          ]}
        >
          <Ionicons
            name={isUnlocked ? world.iconName : 'lock-closed'}
            size={24}
            color={isUnlocked ? world.color : colors.text.quaternary}
          />
        </View>

        <View style={cardSt.body}>
          <Text
            style={[cardSt.worldNum, { color: isUnlocked ? world.color : colors.text.quaternary }]}
          >
            {t('worlds.worldNumber', { n: world.number })}
          </Text>
          <Text style={[cardSt.worldName, { color: colors.text.primary }]} numberOfLines={1}>
            {world.name}
          </Text>
          <Text style={[cardSt.worldDesc, { color: colors.text.tertiary }]} numberOfLines={2}>
            {world.description}
          </Text>

          <View style={cardSt.competenciaTag}>
            <Ionicons
              name="school-outline"
              size={12}
              color={isUnlocked ? world.color : colors.text.quaternary}
            />
            <Text
              style={[cardSt.competenciaText, { color: colors.text.tertiary }]}
              numberOfLines={1}
            >
              {competenciaLabel}
            </Text>
          </View>

          {isUnlocked ? (
            <View style={cardSt.progressRow}>
              <View style={[cardSt.progressTrack, { backgroundColor: colors.materials.highlight }]}>
                <View
                  style={[
                    cardSt.progressFill,
                    { width: `${pct}%` as const, backgroundColor: world.color },
                  ]}
                />
              </View>
              {status === 'dominado' ? (
                <View style={cardSt.masteredTag}>
                  <Ionicons name="checkmark-circle" size={14} color={world.color} />
                  <Text style={[cardSt.masteredText, { color: world.color }]}>
                    {t('worlds.mastered')}
                  </Text>
                </View>
              ) : (
                <Text style={[cardSt.progressLabel, { color: colors.text.tertiary }]}>
                  {done}/{QUESTIONS_PER_WORLD}
                </Text>
              )}
            </View>
          ) : (
            <Text style={[cardSt.lockedNote, { color: colors.text.quaternary }]}>
              {prevWorldName
                ? t('worlds.lockedNoteNamed', { name: prevWorldName })
                : t('worlds.lockedNote', { n: world.number - 1 })}
            </Text>
          )}
        </View>

        {isUnlocked && (
          <Ionicons name="chevron-forward" size={18} color={world.color} style={cardSt.chevron} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function WorldsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  // Per-account key (Firebase uid); fallback to local profile id only offline.
  // Both hooks must run every render (no conditional hook calls).
  const firebaseUid = useAuthStore((s) => s.firebaseUid);
  const localProfileId = useUserStore((s) => s.id);
  const userId = firebaseUid ?? localProfileId;
  // Tenant identity (provisioned students only) — used to rehydrate progress.
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const hasAccess = hasClassAccess(colegioId, cursoId);
  const fetchWorldQuestions = useQuestionBankStore((s) => s.fetchWorldQuestions);
  const getWorldProgress = useQuestionBankStore((s) => s.getWorldProgress);
  const isWorldComplete = useQuestionBankStore((s) => s.isWorldComplete);
  const setRemoteProgress = useQuestionBankStore((s) => s.setRemoteProgress);
  // Subscribe to answers so progress/unlock recompute right after a quiz, without
  // waiting for a remount (the getters above are stable and don't trigger renders).
  const answers = useQuestionBankStore((s) => s.answers);
  // Subscribe to remoteProgress so the cards re-render once hydration resolves.
  const remoteProgress = useQuestionBankStore((s) => s.remoteProgress);

  // Grado comes from the course doc (R4 — never stored on the student). null
  // while resolving so we never prefetch the wrong grade's banco.
  const grado = useStudentGrado();

  // seedKey = Firebase uid (stable per-account); fallback to local id in demo/offline.
  const seedKey = userId ?? 'demo';
  const uid = userId ?? '';

  // Class config (D-ORQ, RQ-PR10): which worlds this class sees and in which
  // order. Live via onSnapshot; null → defaults.
  const { config: classConfig, loaded: classConfigLoaded } = useClassConfig();
  const { worlds: classWorlds } = useMemo(
    () => resolveClassWorlds(classConfig, (w) => isWorldComplete(uid, w as WorldId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classConfig, uid, answers, remoteProgress, isWorldComplete]
  );

  // Visible worlds joined with their display metadata: default defs merged
  // with the professor's overrides, or custom (`cw_*`) worlds built from their
  // config entry (RQ-PR11/PR12). Unknown ids are skipped defensively. The card
  // number is the CLASS-order position; the competencia tag resolves the
  // default mapping, the assigned competency, or the "tema del profesor" label.
  const visibleWorlds = useMemo(
    () =>
      classWorlds
        .map((cw, index) => {
          const entry = classConfig?.mundos?.find((m) => m.worldId === cw.worldId);
          const disp = displayWorldDef(cw.worldId, entry);
          if (!disp) return null;
          const def: WorldDef = { ...disp, number: index + 1 };
          const competencia =
            competenciaForWorld(cw.worldId)?.label ??
            (entry?.competencia && entry.competencia !== COMPETENCIA_PERSONALIZADA
              ? competenciaLabel(entry.competencia)
              : t('worlds.competenciaPersonalizada'));
          return { cw, def, competencia };
        })
        .filter(
          (x): x is { cw: (typeof classWorlds)[number]; def: WorldDef; competencia: string } =>
            x !== null
        ),
    [classWorlds, classConfig, t]
  );

  // Per-world pointer to the course's custom content (RQ-PR11); null without a
  // tenant (demo/offline) → default banks, as always.
  const courseContentFor = (worldId: string) =>
    colegioId && cursoId
      ? {
          colegioId,
          cursoId,
          overrides: classConfig?.overrides?.[worldId],
          version: classConfig?.version ?? 0,
        }
      : null;

  // Prefetch the class's worlds once the real grado AND the class config are
  // known (avoids fetching worlds the class doesn't serve). The store guard
  // keys on (grado, seedKey), so this correctly re-fetches if grade resolves later.
  useEffect(() => {
    if (!hasAccess || !grado || !classConfigLoaded) return;
    for (const { def } of visibleWorlds) {
      void fetchWorldQuestions(grado, def.id, seedKey, courseContentFor(def.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, grado, seedKey, classConfigLoaded, visibleWorlds]);

  // Rehydrate per-world mastery from the tenant tree so unlock/progress survive
  // logout and new devices (the local answers cache is empty there).
  useEffect(() => {
    if (!hasAccess || !colegioId || !cursoId || !firebaseUid) return;
    let cancelled = false;
    void (async () => {
      const docs = await worldProgressRepository.getStudentProgress(
        colegioId,
        cursoId,
        firebaseUid
      );
      if (cancelled) return;
      const byWorld: Partial<Record<WorldId, number>> = {};
      for (const d of docs) byWorld[d.worldId as WorldId] = d.mastery;
      setRemoteProgress(byWorld);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasAccess, colegioId, cursoId, firebaseUid, setRemoteProgress]);

  // Recompute when local answers OR the hydrated remote snapshot change.
  // (getWorldProgress/isWorldComplete read both internally.)
  const progressMap = useMemo<Record<string, number>>(() => {
    const ratio = (worldId: WorldId): number => {
      const { done, total } = getWorldProgress(uid, worldId);
      return total > 0 ? done / total : 0;
    };
    return {
      world_1: ratio('world_1'),
      world_2: ratio('world_2'),
      world_3: ratio('world_3'),
      world_4: ratio('world_4'),
      world_5: ratio('world_5'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, answers, remoteProgress, getWorldProgress]);

  const visibleIds = visibleWorlds.map((v) => v.def.id as string);
  const totalDone = answers.filter(
    (a) => a.uid === uid && a.isCorrect && visibleIds.includes(a.worldId)
  ).length;
  const totalAll = QUESTIONS_PER_WORLD * visibleWorlds.length;

  if (!hasAccess) {
    return (
      <ScreenWrapper style={{ flex: 1, backgroundColor: colors.background.base }}>
        <View style={styles.joinWrap}>
          <ClassCodeForm onJoin={joinClass} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={{ flex: 1, backgroundColor: colors.background.base }}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 8) + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: colors.text.primary }]}>
          {t('worlds.pageTitle')}
        </Text>
        <Text style={[styles.pageSubtitle, { color: colors.text.secondary }]}>
          {t('worlds.lessonsCompleted', { done: totalDone, total: totalAll })}
        </Text>

        <AuthorizationPendingBanner />
        <StudentAssignmentsBanner />

        {!classConfigLoaded ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.text.tertiary} />
          </View>
        ) : visibleWorlds.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="school-outline" size={40} color={colors.text.quaternary} />
            <Text style={[styles.emptyStateText, { color: colors.text.secondary }]}>
              {t('worlds.emptyClass')}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visibleWorlds.map(({ cw, def, competencia }, index) => (
              <WorldCard
                key={def.id}
                world={def}
                competenciaLabel={competencia}
                progress={progressMap[def.id] ?? 0}
                isUnlocked={cw.unlocked}
                prevWorldName={index > 0 ? visibleWorlds[index - 1].def.name : undefined}
                index={index}
                isLast={index === visibleWorlds.length - 1}
                colors={colors}
                onPress={() => router.push(`/saga/${def.id}` as never)}
                t={t}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  joinWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.base },
  scroll: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: 120,
  },
  pageTitle: {
    ...Typography.largeTitle,
    fontWeight: '700',
  },
  pageSubtitle: {
    ...Typography.subheadline,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  list: {
    gap: 0,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 48,
  },
  emptyStateText: {
    ...Typography.subheadline,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
});

const cardSt = StyleSheet.create({
  row: {
    minHeight: 132,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rail: {
    width: 34,
    alignItems: 'center',
  },
  railLine: {
    position: 'absolute',
    width: StyleSheet.hairlineWidth,
  },
  node: {
    width: 24,
    height: 24,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  card: {
    flex: 1,
    minHeight: 112,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 3,
  },
  worldNum: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  worldName: {
    ...Typography.headline,
    fontWeight: '700',
  },
  worldDesc: {
    ...Typography.caption1,
    lineHeight: 17,
  },
  competenciaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  competenciaText: {
    ...Typography.caption2,
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'right',
  },
  masteredTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  masteredText: {
    fontSize: 11,
    fontWeight: '800',
  },
  lockedNote: {
    ...Typography.caption2,
    marginTop: 5,
    fontStyle: 'italic',
  },
  chevron: {
    marginLeft: 2,
  },
});
