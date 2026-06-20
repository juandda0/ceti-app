import { useEffect, useMemo } from 'react';
import { ScrollView, TouchableOpacity, View, Text, StyleSheet, Platform } from 'react-native';
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
import { competenciaForWorld } from '@features/learning/data/competencias';
import StudentAssignmentsBanner from '@features/dashboard/components/StudentAssignmentsBanner';
import JoinClassBanner from '@features/dashboard/components/JoinClassBanner';
import AuthorizationPendingBanner from '@features/dashboard/components/AuthorizationPendingBanner';
import ClassLeaderboard from '@features/dashboard/components/ClassLeaderboard';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import { Spacing, BorderRadius } from '@shared/constants/theme';
import { motion } from '@shared/constants/motion';
import type { ThemeColors } from '@shared/constants/colors';

const WORLD_DEFS = [
  {
    id: 'world_1',
    number: 1,
    name: 'Planeta Origen',
    subtitle: 'El dinero y yo',
    description: 'Qué es el dinero, cómo funciona y tus primeras decisiones financieras.',
    iconName: 'planet' as const,
    color: '#FF8A1F',
  },
  {
    id: 'world_2',
    number: 2,
    name: 'Luna del Presupuesto',
    subtitle: 'Controlar lo que entra y sale',
    description: 'Presupuesto personal, regla 50/30/20 y fondo de emergencia.',
    iconName: 'moon' as const,
    color: '#F7C95F',
  },
  {
    id: 'world_3',
    number: 3,
    name: 'Estrella del Ahorro',
    subtitle: 'Guardar con propósito',
    description: 'Metas SMART, interés compuesto y hábitos de ahorro efectivos.',
    iconName: 'star' as const,
    color: '#58C88C',
  },
  {
    id: 'world_4',
    number: 4,
    name: 'Nebulosa del Crédito',
    subtitle: 'Usar el crédito sin que te use',
    description: 'Tarjetas, historial crediticio y cuándo endeudarse tiene sentido.',
    iconName: 'infinite' as const,
    color: '#A884FF',
  },
  {
    id: 'world_5',
    number: 5,
    name: 'Agujero Negro de las Deudas',
    subtitle: 'Salir de las deudas',
    description: 'Métodos avalancha y bola de nieve para liberarte de deudas.',
    iconName: 'warning' as const,
    color: '#5B9EF5',
  },
] as const;

type WorldDef = (typeof WORLD_DEFS)[number];

function WorldCard({
  world,
  progress,
  isUnlocked,
  index,
  colors,
  onPress,
  t,
}: {
  world: WorldDef;
  progress: number;
  isUnlocked: boolean;
  index: number;
  colors: ThemeColors;
  onPress: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const done = Math.round(progress * QUESTIONS_PER_WORLD);
  const pct = Math.min(Math.round(progress * 100), 100);

  return (
    <Animated.View entering={motion.enterDown(index * 65)}>
      <TouchableOpacity
        activeOpacity={isUnlocked ? 0.8 : 1}
        onPress={isUnlocked ? onPress : undefined}
        accessibilityRole="button"
        accessibilityLabel={t('worlds.openWorld', { n: world.number })}
        accessibilityState={{ disabled: !isUnlocked }}
        style={[
          cardSt.card,
          {
            backgroundColor: colors.background.elevated,
            borderColor: isUnlocked ? world.color : colors.materials.border,
            borderWidth: isUnlocked ? 1.5 : 1,
            opacity: isUnlocked ? 1 : 0.46,
          },
        ]}
      >
        <View
          style={[
            cardSt.iconWrap,
            { backgroundColor: isUnlocked ? world.color + '20' : colors.materials.highlight },
          ]}
        >
          <Ionicons
            name={isUnlocked ? world.iconName : 'lock-closed'}
            size={26}
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
              {competenciaForWorld(world.id).label}
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
              <Text style={[cardSt.progressLabel, { color: colors.text.tertiary }]}>
                {done}/{QUESTIONS_PER_WORLD}
              </Text>
            </View>
          ) : (
            <Text style={[cardSt.lockedNote, { color: colors.text.quaternary }]}>
              {t('worlds.lockedNote', { n: world.number - 1 })}
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

  // Prefetch all worlds once the real grado is known. The store guard keys on
  // (grado, seedKey), so this correctly re-fetches if the grade resolves later.
  useEffect(() => {
    if (!grado) return;
    void fetchWorldQuestions(grado, 'world_1', seedKey);
    void fetchWorldQuestions(grado, 'world_2', seedKey);
    void fetchWorldQuestions(grado, 'world_3', seedKey);
    void fetchWorldQuestions(grado, 'world_4', seedKey);
    void fetchWorldQuestions(grado, 'world_5', seedKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grado, seedKey]);

  // Rehydrate per-world mastery from the tenant tree so unlock/progress survive
  // logout and new devices (the local answers cache is empty there).
  useEffect(() => {
    if (!colegioId || !cursoId || !firebaseUid) return;
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
  }, [colegioId, cursoId, firebaseUid, setRemoteProgress]);

  const uid = userId ?? '';

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

  const unlockedMap = useMemo<Record<string, boolean>>(() => {
    return {
      world_1: true,
      world_2: isWorldComplete(uid, 'world_1'),
      world_3: isWorldComplete(uid, 'world_2'),
      world_4: isWorldComplete(uid, 'world_3'),
      world_5: isWorldComplete(uid, 'world_4'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, answers, remoteProgress, isWorldComplete]);

  const totalDone = answers.filter((a) => a.uid === uid && a.isCorrect).length;
  const totalAll = QUESTIONS_PER_WORLD * WORLD_DEFS.length;

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

        <JoinClassBanner />
        <AuthorizationPendingBanner />
        <StudentAssignmentsBanner />
        <ClassLeaderboard />

        <View style={styles.list}>
          {WORLD_DEFS.map((world, index) => (
            <WorldCard
              key={world.id}
              world={world}
              progress={progressMap[world.id] ?? 0}
              isUnlocked={unlockedMap[world.id] ?? false}
              index={index}
              colors={colors}
              onPress={() => router.push(`/saga/${world.id}` as never)}
              t={t}
            />
          ))}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 120,
    gap: Spacing.sm,
  },
  pageTitle: {
    ...Typography.largeTitle,
    fontWeight: '900',
  },
  pageSubtitle: {
    ...Typography.subheadline,
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  list: {
    gap: 12,
  },
});

const cardSt = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    gap: 14,
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 3,
  },
  worldNum: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  worldName: {
    ...Typography.headline,
    fontWeight: '800',
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
  lockedNote: {
    ...Typography.caption2,
    marginTop: 5,
    fontStyle: 'italic',
  },
  chevron: {
    marginLeft: 2,
  },
});
