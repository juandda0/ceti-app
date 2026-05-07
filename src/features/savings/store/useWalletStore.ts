// store/useWalletStore.ts — Cetis, transacciones y decisiones financieras
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createZustandMmkvStorage } from '@shared/lib/storage/mmkv';

export type TransactionType = 'earned' | 'spent' | 'saved' | 'task_reward';
export type TransactionCategory = 'lesson' | 'task' | 'decision' | 'parent_gift';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  timestamp: number;
  category: TransactionCategory;
}

export interface SavingsGoal {
  /** Meta simple dentro del wallet de Cetis (no confundir con `SavingsGoal` en useSavingsStore — metas COP). */
  name: string;
  targetAmount: number;
  currentAmount: number;
}

interface WalletState {
  totalCetis: number;
  savedCetis: number;
  spentCetis: number;
  transactions: Transaction[];
  savingsGoal: SavingsGoal | null;
}

interface WalletActions {
  earnCetis: (amount: number, description: string, category: TransactionCategory) => void;
  spendCetis: (amount: number, description: string) => boolean;
  saveCetis: (amount: number) => boolean;
  withdrawSavings: (amount: number) => boolean;
  setSavingsGoal: (goal: SavingsGoal | null) => void;
  addToGoal: (amount: number) => boolean;
  resetWallet: () => void;
}

type WalletStore = WalletState & WalletActions;

/** Solo `__DEV__`: saldo alto para probar el mundo sin acumular Cetis. En release el inicio es 0. */
const DEV_DEFAULT_CETIS = 9_999_999;

function defaultTotalCetis(): number {
  return __DEV__ ? DEV_DEFAULT_CETIS : 0;
}

function generateId(): string {
  return `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

const initialState: WalletState = {
  totalCetis: defaultTotalCetis(),
  savedCetis: 0,
  spentCetis: 0,
  transactions: [],
  savingsGoal: null,
};

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      earnCetis: (amount, description, category) => {
        const tx: Transaction = {
          id: generateId(),
          type: category === 'task' ? 'task_reward' : 'earned',
          amount,
          description,
          timestamp: Date.now(),
          category,
        };
        set((state) => ({
          totalCetis: state.totalCetis + amount,
          transactions: [tx, ...state.transactions].slice(0, 50), // Máximo 50
        }));
      },

      spendCetis: (amount, description) => {
        const { totalCetis } = get();
        if (totalCetis < amount) return false;

        const tx: Transaction = {
          id: generateId(),
          type: 'spent',
          amount,
          description,
          timestamp: Date.now(),
          category: 'decision',
        };
        set((state) => ({
          totalCetis: state.totalCetis - amount,
          spentCetis: state.spentCetis + amount,
          transactions: [tx, ...state.transactions].slice(0, 50),
        }));
        return true;
      },

      saveCetis: (amount) => {
        const { totalCetis } = get();
        if (totalCetis < amount) return false;

        const tx: Transaction = {
          id: generateId(),
          type: 'saved',
          amount,
          description: 'Ahorro voluntario',
          timestamp: Date.now(),
          category: 'decision',
        };
        set((state) => ({
          totalCetis: state.totalCetis - amount,
          savedCetis: state.savedCetis + amount,
          transactions: [tx, ...state.transactions].slice(0, 50),
        }));
        return true;
      },

      withdrawSavings: (amount) => {
        const { savedCetis } = get();
        if (savedCetis < amount) return false;

        set((state) => ({
          totalCetis: state.totalCetis + amount,
          savedCetis: state.savedCetis - amount,
        }));
        return true;
      },

      setSavingsGoal: (goal) => set({ savingsGoal: goal }),

      addToGoal: (amount) => {
        const { totalCetis, savingsGoal } = get();
        if (!savingsGoal || totalCetis < amount) return false;

        const tx: Transaction = {
          id: generateId(),
          type: 'saved',
          amount,
          description: `Meta: ${savingsGoal.name}`,
          timestamp: Date.now(),
          category: 'decision',
        };

        set((state) => ({
          totalCetis: state.totalCetis - amount,
          savingsGoal: state.savingsGoal
            ? {
                ...state.savingsGoal,
                currentAmount: state.savingsGoal.currentAmount + amount,
              }
            : null,
          transactions: [tx, ...state.transactions].slice(0, 50),
        }));
        return true;
      },

      resetWallet: () => set(initialState),
    }),
    {
      name: 'wallet-store',
      storage: createJSONStorage(() => createZustandMmkvStorage()),
      merge: (persisted, current) => {
        const p = persisted as Partial<WalletState> | undefined;
        const next = { ...current, ...p } as WalletStore;
        if (__DEV__) {
          next.totalCetis = DEV_DEFAULT_CETIS;
        }
        return next;
      },
    }
  )
);
