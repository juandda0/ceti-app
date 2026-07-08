import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import { logEvent } from '@shared/lib/analytics/logEvent';

export type GoalFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total';

export type GoalCategory = 'electronics' | 'toy' | 'trip' | 'education' | 'emergency' | 'custom';

export interface SavingsGoal {
  id: string;
  title: string;
  description: string;
  emoji: string;
  targetAmount: number;
  currentAmount: number;
  frequency: GoalFrequency;
  createdAt: number;
  deadline?: number;
  completedAt?: number;
  category: GoalCategory;
}

export interface SavingsDeposit {
  id: string;
  goalId?: string;
  amount: number;
  description: string;
  createdAt: number;
  note?: string;
}

interface SavingsState {
  goals: SavingsGoal[];
  deposits: SavingsDeposit[];
}

interface SavingsActions {
  addGoal: (data: Omit<SavingsGoal, 'id' | 'createdAt' | 'currentAmount'>) => SavingsGoal;
  addDeposit: (amount: number, description: string, goalId?: string, note?: string) => void;
  removeGoal: (goalId: string) => void;
  resetSavings: () => void;
  getTotalSaved: () => number;
  getGoalProgress: (goalId: string) => number;
}

type SavingsStore = SavingsState & SavingsActions;

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const useSavingsStore = create<SavingsStore>()(
  persist(
    (set, get) => ({
      goals: [],
      deposits: [],

      addGoal: (data) => {
        const goal: SavingsGoal = {
          ...data,
          id: `goal_${uid()}`,
          currentAmount: 0,
          createdAt: Date.now(),
        };
        set((s) => ({ goals: [...s.goals, goal] }));
        void logEvent('goal_created', { category: data.category });
        return goal;
      },

      addDeposit: (amount, description, goalId, note) => {
        const deposit: SavingsDeposit = {
          id: `dep_${uid()}`,
          goalId,
          amount,
          description,
          note,
          createdAt: Date.now(),
        };

        set((s) => {
          const updatedGoals = goalId
            ? s.goals.map((g) => {
                if (g.id !== goalId) return g;
                const currentAmount = g.currentAmount + amount;
                const justCompleted =
                  !g.completedAt && g.targetAmount > 0 && currentAmount >= g.targetAmount;
                return {
                  ...g,
                  currentAmount,
                  completedAt: justCompleted ? Date.now() : g.completedAt,
                };
              })
            : s.goals;

          return {
            deposits: [...s.deposits, deposit],
            goals: updatedGoals,
          };
        });

        // CA6 (RQ-ES10): los deposits pueden originarse en movimientos reales
        // vía el puente D-ES10-04 — analytics jamás recibe montos.
        void logEvent('deposit_created', { has_goal: Boolean(goalId) });

        void (async () => {
          try {
            const { useAuthStore } = await import('@features/auth/store/useAuthStore');
            const uid = useAuthStore.getState().firebaseUid;
            if (!uid) return;
            const { depositsRepository } =
              await import('@features/savings/data/depositsRepository');
            await depositsRepository.upsertDeposit(uid, deposit);
            if (goalId) {
              const { goalsRepository } = await import('@features/savings/data/goalsRepository');
              const goal = useSavingsStore.getState().goals.find((g) => g.id === goalId);
              if (goal) await goalsRepository.upsertGoal(uid, goal);
            }
          } catch (e) {
            void import('@shared/lib/analytics/crashlytics').then((m) =>
              m.recordError(e instanceof Error ? e : new Error(String(e)), 'savings_add_deposit')
            );
          }
        })();
      },

      removeGoal: (goalId) => {
        set((s) => ({ goals: s.goals.filter((g) => g.id !== goalId) }));
        void (async () => {
          try {
            const { useAuthStore } = await import('@features/auth/store/useAuthStore');
            const uid = useAuthStore.getState().firebaseUid;
            if (!uid) return;
            const { goalsRepository } = await import('@features/savings/data/goalsRepository');
            await goalsRepository.removeGoal(uid, goalId);
          } catch (e) {
            void import('@shared/lib/analytics/crashlytics').then((m) =>
              m.recordError(e instanceof Error ? e : new Error(String(e)), 'savings_remove_goal')
            );
          }
        })();
      },

      resetSavings: () => set({ goals: [], deposits: [] }),

      getTotalSaved: () => get().deposits.reduce((acc, d) => acc + d.amount, 0),

      getGoalProgress: (goalId) => {
        const goal = get().goals.find((g) => g.id === goalId);
        if (!goal || goal.targetAmount === 0) return 0;
        return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
      },
    }),
    {
      name: 'savings-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
    }
  )
);
