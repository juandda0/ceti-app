// store/useSavingsStore.ts — Sistema completo de metas de ahorro y alcancía con aprobación parental
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import { logEvent } from '@shared/lib/analytics/logEvent';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type GoalFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total';
export type GoalSource = 'child' | 'parent'; // quién creó la meta
export type DepositStatus = 'pending' | 'approved' | 'rejected';

export interface SavingsGoal {
  id: string;
  childId: string;
  title: string;
  description: string;
  emoji: string;
  targetAmount: number; // en pesos colombianos
  currentAmount: number;
  frequency: GoalFrequency;
  source: GoalSource; // 'child' | 'parent'
  createdAt: number;
  deadline?: number; // timestamp opcional
  completedAt?: number;
  category: GoalCategory;
}

export type GoalCategory =
  | 'electronics' // Celular, tablet, computador
  | 'toy' // Juguete, videojuego
  | 'trip' // Viaje, paseo
  | 'education' // Curso, libro
  | 'emergency' // Fondo de emergencia
  | 'custom'; // Libre

export interface SavingsDeposit {
  id: string;
  childId: string;
  goalId?: string; // a qué meta aplica (opcional — puede ser ahorro libre)
  amount: number; // pesos colombianos
  description: string; // ej. "Guardé en alcancía de cerámica"
  status: DepositStatus;
  submittedAt: number;
  reviewedAt?: number;
  parentNote?: string; // nota del padre al aprobar/rechazar
  receiptNote?: string; // nota del niño (dónde guardó el dinero)
}

// ── Estado y acciones ─────────────────────────────────────────────────────────

interface SavingsState {
  goals: SavingsGoal[];
  deposits: SavingsDeposit[];
}

interface SavingsActions {
  // Child actions
  addChildGoal: (
    childId: string,
    data: Omit<SavingsGoal, 'id' | 'childId' | 'createdAt' | 'source' | 'currentAmount'>
  ) => void;
  submitDeposit: (
    childId: string,
    amount: number,
    description: string,
    goalId?: string,
    receiptNote?: string
  ) => void;

  // Parent actions
  addParentGoal: (
    childId: string,
    data: Omit<SavingsGoal, 'id' | 'childId' | 'createdAt' | 'source' | 'currentAmount'>
  ) => void;
  approveDeposit: (depositId: string, note?: string) => void;
  rejectDeposit: (depositId: string, note: string) => void;
  removeGoal: (goalId: string) => void;
  resetSavings: () => void;

  // Queries
  getGoalsForChild: (childId: string) => SavingsGoal[];
  getParentGoalsForChild: (childId: string) => SavingsGoal[];
  getPendingDeposits: (childId?: string) => SavingsDeposit[];
  getApprovedDeposits: (childId: string) => SavingsDeposit[];
  getTotalSaved: (childId: string) => number;
  getGoalProgress: (goalId: string) => number; // 0–100
}

type SavingsStore = SavingsState & SavingsActions;

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useSavingsStore = create<SavingsStore>()(
  persist(
    (set, get) => ({
      goals: [],
      deposits: [],

      // ── Child ──────────────────────────────────────────────────────────────

      addChildGoal: (childId, data) => {
        const goal: SavingsGoal = {
          ...data,
          id: `goal_${uid()}`,
          childId,
          source: 'child',
          currentAmount: 0,
          createdAt: Date.now(),
        };
        set((s) => ({ goals: [...s.goals, goal] }));
      },

      submitDeposit: (childId, amount, description, goalId, receiptNote) => {
        const deposit: SavingsDeposit = {
          id: `dep_${uid()}`,
          childId,
          goalId,
          amount,
          description,
          receiptNote,
          status: 'pending',
          submittedAt: Date.now(),
        };
        set((s) => ({ deposits: [...s.deposits, deposit] }));
        void logEvent('deposit_created', {
          amount,
          has_goal: Boolean(goalId),
        });
      },

      // ── Parent ─────────────────────────────────────────────────────────────

      addParentGoal: (childId, data) => {
        const goal: SavingsGoal = {
          ...data,
          id: `goal_${uid()}`,
          childId,
          source: 'parent',
          currentAmount: 0,
          createdAt: Date.now(),
        };
        set((s) => ({ goals: [...s.goals, goal] }));
      },

      approveDeposit: (depositId, note) => {
        const deposit = get().deposits.find((d) => d.id === depositId);
        if (!deposit || deposit.status !== 'pending') return;

        let completedGoalId: string | undefined;

        set((s) => {
          const dep = s.deposits.find((d) => d.id === depositId);
          if (!dep || dep.status !== 'pending') return s;

          const updatedGoals = dep.goalId
            ? s.goals.map((g) => {
                if (g.id !== dep.goalId) return g;
                const currentAmount = g.currentAmount + dep.amount;
                const justCompleted =
                  !g.completedAt && g.targetAmount > 0 && currentAmount >= g.targetAmount;
                if (justCompleted) completedGoalId = g.id;
                return {
                  ...g,
                  currentAmount,
                  completedAt: justCompleted ? Date.now() : g.completedAt,
                };
              })
            : s.goals;

          return {
            deposits: s.deposits.map((d) =>
              d.id === depositId
                ? {
                    ...d,
                    status: 'approved' as DepositStatus,
                    reviewedAt: Date.now(),
                    parentNote: note,
                  }
                : d
            ),
            goals: updatedGoals,
          };
        });

        void logEvent('deposit_approved', {
          amount: deposit.amount,
        });
        if (completedGoalId) {
          void logEvent('goal_completed', {
            goal_id: completedGoalId,
          });
        }
      },

      rejectDeposit: (depositId, note) => {
        set((s) => {
          const deposit = s.deposits.find((d) => d.id === depositId);
          if (!deposit || deposit.status !== 'pending') return s;
          return {
            deposits: s.deposits.map((d) =>
              d.id === depositId
                ? {
                    ...d,
                    status: 'rejected' as DepositStatus,
                    reviewedAt: Date.now(),
                    parentNote: note,
                  }
                : d
            ),
          };
        });
      },

      removeGoal: (goalId) => {
        set((s) => ({ goals: s.goals.filter((g) => g.id !== goalId) }));
      },

      resetSavings: () => set({ goals: [], deposits: [] }),

      // ── Queries ────────────────────────────────────────────────────────────

      getGoalsForChild: (childId) => get().goals.filter((g) => g.childId === childId),

      getParentGoalsForChild: (childId) =>
        get().goals.filter((g) => g.childId === childId && g.source === 'parent'),

      getPendingDeposits: (childId) =>
        get().deposits.filter(
          (d) => d.status === 'pending' && (childId ? d.childId === childId : true)
        ),

      getApprovedDeposits: (childId) =>
        get().deposits.filter((d) => d.childId === childId && d.status === 'approved'),

      getTotalSaved: (childId) =>
        get()
          .deposits.filter((d) => d.childId === childId && d.status === 'approved')
          .reduce((acc, d) => acc + d.amount, 0),

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
