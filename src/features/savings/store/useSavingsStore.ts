import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';
import { logEvent } from '@shared/lib/analytics/logEvent';
import {
  projectSavings,
  validateSavingsChange,
  type GoalIconId,
  type SavingsGoal as DomainSavingsGoal,
  type SavingsOperation,
} from '@features/savings/domain/savings';

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
  iconId?: GoalIconId;
  updatedAt?: number;
  deletedAt?: number;
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
  operations: SavingsOperation[];
}

type MutationFailure =
  | 'not_found'
  | 'invalid_data'
  | 'insufficient_goal'
  | 'insufficient_unassigned'
  | 'persistence_failed';
type MutationResult<T> = { ok: true; value: T } | { ok: false; reason: MutationFailure };
type GoalInput = Pick<DomainSavingsGoal, 'title' | 'iconId' | 'category' | 'targetAmount'> &
  Partial<Pick<DomainSavingsGoal, 'deadline'>>;
type GoalChanges = Partial<GoalInput>;
type OperationInput = Omit<SavingsOperation, 'id' | 'createdAt' | 'updatedAt'>;
type OperationChanges = Partial<Omit<OperationInput, 'fecha'>> & { fecha?: number };

interface SavingsActions {
  addGoal: (
    data: Omit<
      SavingsGoal,
      'id' | 'createdAt' | 'currentAmount' | 'updatedAt' | 'iconId' | 'deletedAt'
    >
  ) => SavingsGoal;
  addDeposit: (
    amount: number,
    description: string,
    goalId?: string,
    note?: string,
    depositId?: string
  ) => void;
  removeDeposit: (depositId: string) => void;
  removeGoal: (goalId: string) => void;
  resetSavings: () => void;
  getTotalSaved: () => number;
  getGoalProgress: (goalId: string) => number;
  createGoal: (data: GoalInput) => Promise<MutationResult<SavingsGoal>>;
  updateGoal: (goalId: string, changes: GoalChanges) => Promise<MutationResult<SavingsGoal>>;
  deleteGoal: (goalId: string) => Promise<MutationResult<SavingsGoal>>;
  createOperation: (data: OperationInput) => Promise<MutationResult<SavingsOperation>>;
  updateOperation: (
    operationId: string,
    changes: OperationChanges
  ) => Promise<MutationResult<SavingsOperation>>;
  deleteOperation: (operationId: string) => Promise<MutationResult<SavingsOperation>>;
  projection: () => ReturnType<typeof projectSavings>;
}

type SavingsStore = SavingsState & SavingsActions;

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function toDomainGoals(goals: SavingsGoal[]): DomainSavingsGoal[] {
  return goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    iconId: goal.iconId ?? 'target',
    category: goal.category,
    targetAmount: goal.targetAmount,
    ...(goal.deadline === undefined ? {} : { deadline: goal.deadline }),
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt ?? goal.createdAt,
    ...(goal.deletedAt === undefined ? {} : { deletedAt: goal.deletedAt }),
  }));
}

export const useSavingsStore = create<SavingsStore>()(
  persist(
    (set, get) => ({
      goals: [],
      deposits: [],
      operations: [],

      addGoal: (data) => {
        const now = Date.now();
        const goal: SavingsGoal = {
          ...data,
          id: `goal_${uid()}`,
          currentAmount: 0,
          createdAt: now,
          updatedAt: now,
          iconId: 'target',
        };
        set((s) => ({ goals: [...s.goals, goal] }));
        void logEvent('goal_created', { category: data.category });
        return goal;
      },

      addDeposit: (amount, description, goalId, note, depositId) => {
        const deposit: SavingsDeposit = {
          // depositId permite al puente de movimientos (RQ-ES10 D-ES10-04) ligar
          // 1:1 el depósito con el movimiento, para poder revertirlo al borrar.
          id: depositId ?? `dep_${uid()}`,
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

      removeDeposit: (depositId) => {
        const deposit = get().deposits.find((d) => d.id === depositId);
        if (!deposit) return;

        set((s) => {
          const updatedGoals = deposit.goalId
            ? s.goals.map((g) => {
                if (g.id !== deposit.goalId) return g;
                const currentAmount = Math.max(0, g.currentAmount - deposit.amount);
                // Si el retiro baja del objetivo, la meta deja de estar completa.
                const stillComplete = g.targetAmount > 0 && currentAmount >= g.targetAmount;
                return {
                  ...g,
                  currentAmount,
                  completedAt: stillComplete ? g.completedAt : undefined,
                };
              })
            : s.goals;
          return {
            deposits: s.deposits.filter((d) => d.id !== depositId),
            goals: updatedGoals,
          };
        });

        void (async () => {
          try {
            const { useAuthStore } = await import('@features/auth/store/useAuthStore');
            const uid = useAuthStore.getState().firebaseUid;
            if (!uid) return;
            const { depositsRepository } =
              await import('@features/savings/data/depositsRepository');
            await depositsRepository.removeDeposit(uid, depositId);
            if (deposit.goalId) {
              const { goalsRepository } = await import('@features/savings/data/goalsRepository');
              const goal = useSavingsStore.getState().goals.find((g) => g.id === deposit.goalId);
              if (goal) await goalsRepository.upsertGoal(uid, goal);
            }
          } catch (e) {
            void import('@shared/lib/analytics/crashlytics').then((m) =>
              m.recordError(e instanceof Error ? e : new Error(String(e)), 'savings_remove_deposit')
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

      resetSavings: () => set({ goals: [], deposits: [], operations: [] }),

      getTotalSaved: () => get().deposits.reduce((acc, d) => acc + d.amount, 0),

      getGoalProgress: (goalId) => {
        const goal = get().goals.find((g) => g.id === goalId);
        if (!goal || goal.targetAmount === 0) return 0;
        return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
      },

      createGoal: async (data) => {
        const title = data.title.trim();
        if (!title || !Number.isInteger(data.targetAmount) || data.targetAmount <= 0) {
          return { ok: false, reason: 'invalid_data' };
        }
        const now = Date.now();
        const goal: SavingsGoal = {
          id: `goal_${uid()}`,
          title,
          iconId: data.iconId,
          category: data.category,
          targetAmount: data.targetAmount,
          ...(data.deadline === undefined ? {} : { deadline: data.deadline }),
          createdAt: now,
          updatedAt: now,
          currentAmount: 0,
          description: '',
          emoji: '',
          frequency: 'total',
        };
        const previous = get().goals;
        set({ goals: [...previous, goal] });
        try {
          const { useAuthStore } = await import('@features/auth/store/useAuthStore');
          const authUid = useAuthStore.getState().firebaseUid;
          if (authUid) {
            const { goalsRepository } = await import('@features/savings/data/goalsRepository');
            await goalsRepository.upsertGoal(authUid, goal);
          }
          void logEvent('goal_created', { category: data.category });
          return { ok: true, value: goal };
        } catch (error) {
          set({ goals: previous });
          void import('@shared/lib/analytics/crashlytics').then((module) =>
            module.recordError(
              error instanceof Error ? error : new Error(String(error)),
              'savings_create_goal'
            )
          );
          return { ok: false, reason: 'persistence_failed' };
        }
      },

      updateGoal: async (goalId, changes) => {
        const previous = get().goals;
        const current = previous.find((goal) => goal.id === goalId && !goal.deletedAt);
        if (!current) return { ok: false, reason: 'not_found' };
        const updated: SavingsGoal = {
          ...current,
          ...changes,
          title: changes.title === undefined ? current.title : changes.title.trim(),
          updatedAt: Date.now(),
        };
        if (
          !updated.title ||
          !Number.isInteger(updated.targetAmount) ||
          updated.targetAmount <= 0
        ) {
          return { ok: false, reason: 'invalid_data' };
        }
        set({ goals: previous.map((goal) => (goal.id === goalId ? updated : goal)) });
        try {
          const { useAuthStore } = await import('@features/auth/store/useAuthStore');
          const authUid = useAuthStore.getState().firebaseUid;
          if (authUid) {
            const { goalsRepository } = await import('@features/savings/data/goalsRepository');
            await goalsRepository.upsertGoal(authUid, updated);
          }
          void logEvent('goal_updated');
          return { ok: true, value: updated };
        } catch (error) {
          set({ goals: previous });
          void import('@shared/lib/analytics/crashlytics').then((module) =>
            module.recordError(
              error instanceof Error ? error : new Error(String(error)),
              'savings_update_goal'
            )
          );
          return { ok: false, reason: 'persistence_failed' };
        }
      },

      deleteGoal: async (goalId) => {
        const previous = get().goals;
        const current = previous.find((goal) => goal.id === goalId && !goal.deletedAt);
        if (!current) return { ok: false, reason: 'not_found' };
        const deleted = { ...current, updatedAt: Date.now(), deletedAt: Date.now() };
        set({ goals: previous.map((goal) => (goal.id === goalId ? deleted : goal)) });
        try {
          const { useAuthStore } = await import('@features/auth/store/useAuthStore');
          const authUid = useAuthStore.getState().firebaseUid;
          if (authUid) {
            const { goalsRepository } = await import('@features/savings/data/goalsRepository');
            await goalsRepository.upsertGoal(authUid, deleted);
          }
          void logEvent('goal_deleted');
          return { ok: true, value: deleted };
        } catch (error) {
          set({ goals: previous });
          void import('@shared/lib/analytics/crashlytics').then((module) =>
            module.recordError(
              error instanceof Error ? error : new Error(String(error)),
              'savings_delete_goal'
            )
          );
          return { ok: false, reason: 'persistence_failed' };
        }
      },

      createOperation: async (data) => {
        const now = Date.now();
        const operation: SavingsOperation = {
          ...data,
          description: data.description.trim(),
          id: `op_${uid()}`,
          createdAt: now,
          updatedAt: now,
        };
        if (!Number.isInteger(operation.amount) || operation.amount <= 0 || operation.fecha > now) {
          return { ok: false, reason: 'invalid_data' };
        }
        const previous = get().operations;
        const next = [...previous, operation];
        const validation = validateSavingsChange(toDomainGoals(get().goals), next);
        if (!validation.ok) return { ok: false, reason: validation.reason };
        set({ operations: next });
        try {
          const { useAuthStore } = await import('@features/auth/store/useAuthStore');
          const authUid = useAuthStore.getState().firebaseUid;
          if (authUid) {
            const { depositsRepository } =
              await import('@features/savings/data/depositsRepository');
            await depositsRepository.upsertOperation(authUid, operation);
          }
          void logEvent('savings_operation_created', {
            type: data.type,
            has_goal: Boolean(data.goalId),
          });
          return { ok: true, value: operation };
        } catch (error) {
          set({ operations: previous });
          void import('@shared/lib/analytics/crashlytics').then((module) =>
            module.recordError(
              error instanceof Error ? error : new Error(String(error)),
              'savings_create_operation'
            )
          );
          return { ok: false, reason: 'persistence_failed' };
        }
      },

      updateOperation: async (operationId, changes) => {
        const previous = get().operations;
        const current = previous.find((operation) => operation.id === operationId);
        if (!current) return { ok: false, reason: 'not_found' };
        const updated = { ...current, ...changes, updatedAt: Date.now() };
        if (
          !Number.isInteger(updated.amount) ||
          updated.amount <= 0 ||
          updated.fecha > Date.now()
        ) {
          return { ok: false, reason: 'invalid_data' };
        }
        const next = previous.map((operation) =>
          operation.id === operationId ? updated : operation
        );
        const validation = validateSavingsChange(toDomainGoals(get().goals), next);
        if (!validation.ok) return { ok: false, reason: validation.reason };
        set({ operations: next });
        try {
          const { useAuthStore } = await import('@features/auth/store/useAuthStore');
          const authUid = useAuthStore.getState().firebaseUid;
          if (authUid) {
            const { depositsRepository } =
              await import('@features/savings/data/depositsRepository');
            await depositsRepository.upsertOperation(authUid, updated);
          }
          void logEvent('savings_operation_updated', { type: updated.type });
          return { ok: true, value: updated };
        } catch (error) {
          set({ operations: previous });
          void import('@shared/lib/analytics/crashlytics').then((module) =>
            module.recordError(
              error instanceof Error ? error : new Error(String(error)),
              'savings_update_operation'
            )
          );
          return { ok: false, reason: 'persistence_failed' };
        }
      },

      deleteOperation: async (operationId) => {
        const previous = get().operations;
        const current = previous.find((operation) => operation.id === operationId);
        if (!current) return { ok: false, reason: 'not_found' };
        const next = previous.filter((operation) => operation.id !== operationId);
        const validation = validateSavingsChange(toDomainGoals(get().goals), next);
        if (!validation.ok) return { ok: false, reason: validation.reason };
        set({ operations: next });
        try {
          const { useAuthStore } = await import('@features/auth/store/useAuthStore');
          const authUid = useAuthStore.getState().firebaseUid;
          if (authUid) {
            const { depositsRepository } =
              await import('@features/savings/data/depositsRepository');
            await depositsRepository.removeDeposit(authUid, operationId);
          }
          void logEvent('savings_operation_deleted', { type: current.type });
          return { ok: true, value: current };
        } catch (error) {
          set({ operations: previous });
          void import('@shared/lib/analytics/crashlytics').then((module) =>
            module.recordError(
              error instanceof Error ? error : new Error(String(error)),
              'savings_delete_operation'
            )
          );
          return { ok: false, reason: 'persistence_failed' };
        }
      },

      projection: () => projectSavings(toDomainGoals(get().goals), get().operations),
    }),
    {
      name: 'savings-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
    }
  )
);
