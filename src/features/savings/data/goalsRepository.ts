import { api, isBackendConfigured, seg } from '@shared/lib/api/client';
import type { SavingsGoal } from '@features/savings/store/useSavingsStore';

export const goalsRepository = {
  /** Las metas no se borran por API: el borrado es blando (deletedAt). */
  async upsertGoal(goal: SavingsGoal): Promise<boolean> {
    if (!isBackendConfigured()) return false;
    await api.put(`/api/me/goals/${seg(goal.id)}`, {
      id: goal.id,
      title: goal.title,
      iconId: goal.iconId ?? 'target',
      category: goal.category,
      targetAmount: goal.targetAmount,
      deadline: goal.deadline,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt ?? goal.createdAt,
      deletedAt: goal.deletedAt,
    });
    return true;
  },
};
