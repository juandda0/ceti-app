// hooks/useRewards.ts — Motor de desbloqueo de badges
import { useCallback } from 'react';
import { useChildStore } from '@features/auth/store/useChildStore';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import { useLessonsStore } from '@features/learning/store/useLessonsStore';
import { BADGES, Badge, BadgeConditionType } from '@/data/badges';

/**
 * Hook que evalúa y aplica desbloqueos automáticos de badges.
 * Llamar después de cualquier acción que pueda desbloquear algo.
 */
export function useRewards() {
  const store = useChildStore();
  const wallet = useWalletStore();
  const lessons = useLessonsStore();

  const getConditionValue = useCallback((type: BadgeConditionType): number => {
    switch (type) {
      case 'lessons_completed': return lessons.completedLessons.length;
      case 'saved_cetis': return wallet.savedCetis;
      case 'streak': return store.streak;
      case 'savings_decisions': return store.savingsDecisions;
      case 'savings_goal_set': return wallet.savingsGoal ? 1 : 0;
      case 'goals_completed': return store.goalsCompleted;
      case 'level': return store.level;
      default: return 0;
    }
  }, [lessons.completedLessons.length, wallet.savedCetis, store.streak, store.savingsDecisions, wallet.savingsGoal, store.goalsCompleted, store.level]);

  const checkBadges = useCallback(() => {
    const newBadges: Badge[] = [];
    const { unlockedBadges, unlockBadge } = store;
    
    for (const badge of BADGES) {
      if (unlockedBadges.includes(badge.id)) continue;
      const currentValue = getConditionValue(badge.conditionType);
      if (currentValue >= badge.conditionValue) {
        unlockBadge(badge.id);
        newBadges.push(badge);
      }
    }
    return newBadges;
  }, [store.unlockedBadges, store.unlockBadge, getConditionValue]);

  const checkAll = useCallback(() => {
    return { badges: checkBadges() };
  }, [checkBadges]);

  return { checkBadges, checkAll };
}
