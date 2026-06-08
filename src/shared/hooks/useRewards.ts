// hooks/useRewards.ts — Motor de desbloqueo de badges
import { useCallback } from 'react';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import { useLessonsStore } from '@features/learning/store/useLessonsStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useQuestionBankStore } from '@features/learning/store/useQuestionBankStore';
import { masteryPercent } from '@features/learning/data/mastery';
import { BADGES, Badge, BadgeConditionType } from '@shared/data/badges';

/**
 * Hook que evalúa y aplica desbloqueos automáticos de badges.
 * Llamar después de cualquier acción que pueda desbloquear algo.
 */
export function useRewards() {
  const store = useUserStore();
  const wallet = useWalletStore();
  const lessons = useLessonsStore();
  const savingsGoals = useSavingsStore((s) => s.goals);
  const getWorldProgress = useQuestionBankStore((s) => s.getWorldProgress);

  // Mastery (0..100) for a world's quiz; drives achievement-based badges.
  const getWorldMastery = useCallback(
    (worldId: NonNullable<Badge['worldId']>): number => {
      const userId = (store.id || '').trim();
      if (!userId) return 0;
      const { done, total } = getWorldProgress(userId, worldId);
      return masteryPercent(done, total);
    },
    [store.id, getWorldProgress]
  );

  const getConditionValue = useCallback(
    (type: BadgeConditionType): number => {
      const userId = (store.id || '').trim();
      const lessonCount = userId
        ? lessons.completedLessons.filter((l) => l.uid === userId).length
        : 0;

      switch (type) {
        case 'lessons_completed':
          return lessonCount;
        case 'saved_cetis':
          return wallet.savedCetis;
        case 'streak':
          return store.streak;
        case 'savings_decisions':
          return store.savingsDecisions;
        case 'savings_goal_set':
          return wallet.savingsGoal ? 1 : 0;
        case 'goals_completed':
          return savingsGoals.filter(
            (g) =>
              Boolean(g.completedAt) || (g.targetAmount > 0 && g.currentAmount >= g.targetAmount)
          ).length;
        case 'level':
          return store.level;
        default:
          return 0;
      }
    },
    [
      lessons.completedLessons,
      wallet.savedCetis,
      store.streak,
      store.id,
      store.savingsDecisions,
      wallet.savingsGoal,
      savingsGoals,
      store.level,
    ]
  );

  const checkBadges = useCallback(() => {
    const newBadges: Badge[] = [];
    const { unlockedBadges, unlockBadge } = store;

    for (const badge of BADGES) {
      if (unlockedBadges.includes(badge.id)) continue;
      const currentValue =
        badge.conditionType === 'world_mastery' && badge.worldId
          ? getWorldMastery(badge.worldId)
          : getConditionValue(badge.conditionType);
      if (currentValue >= badge.conditionValue) {
        unlockBadge(badge.id);
        newBadges.push(badge);
      }
    }
    return newBadges;
  }, [store.unlockedBadges, store.unlockBadge, getConditionValue, getWorldMastery]);

  const checkAll = useCallback(() => {
    return { badges: checkBadges() };
  }, [checkBadges]);

  return { checkBadges, checkAll };
}
