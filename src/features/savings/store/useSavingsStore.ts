// store/useSavingsStore.ts — Sistema completo de metas de ahorro y alcancía con aprobación parental
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type GoalFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total';
export type GoalSource = 'child' | 'parent';   // quién creó la meta
export type DepositStatus = 'pending' | 'approved' | 'rejected';

export interface SavingsGoal {
  id: string;
  childId: string;
  title: string;
  description: string;
  emoji: string;
  targetAmount: number;         // en pesos colombianos
  currentAmount: number;
  frequency: GoalFrequency;
  source: GoalSource;           // 'child' | 'parent'
  createdAt: number;
  deadline?: number;            // timestamp opcional
  completedAt?: number;
  category: GoalCategory;
}

export type GoalCategory =
  | 'electronics'   // Celular, tablet, computador
  | 'toy'           // Juguete, videojuego
  | 'trip'          // Viaje, paseo
  | 'education'     // Curso, libro
  | 'emergency'     // Fondo de emergencia
  | 'custom';       // Libre

export interface SavingsDeposit {
  id: string;
  childId: string;
  goalId?: string;              // a qué meta aplica (opcional — puede ser ahorro libre)
  amount: number;               // pesos colombianos
  description: string;         // ej. "Guardé en alcancía de cerámica"
  status: DepositStatus;
  submittedAt: number;
  reviewedAt?: number;
  parentNote?: string;          // nota del padre al aprobar/rechazar
  receiptNote?: string;         // nota del niño (dónde guardó el dinero)
}

// ── Estado y acciones ─────────────────────────────────────────────────────────

interface SavingsState {
  goals: SavingsGoal[];
  deposits: SavingsDeposit[];
}

interface SavingsActions {
  // Child actions
  addChildGoal: (childId: string, data: Omit<SavingsGoal, 'id' | 'childId' | 'createdAt' | 'source' | 'currentAmount'>) => void;
  submitDeposit: (childId: string, amount: number, description: string, goalId?: string, receiptNote?: string) => void;

  // Parent actions
  addParentGoal: (childId: string, data: Omit<SavingsGoal, 'id' | 'childId' | 'createdAt' | 'source' | 'currentAmount'>) => void;
  approveDeposit: (depositId: string, note?: string) => void;
  rejectDeposit: (depositId: string, note: string) => void;
  removeGoal: (goalId: string) => void;

  // Queries
  getGoalsForChild: (childId: string) => SavingsGoal[];
  getParentGoalsForChild: (childId: string) => SavingsGoal[];
  getPendingDeposits: (childId?: string) => SavingsDeposit[];
  getApprovedDeposits: (childId: string) => SavingsDeposit[];
  getTotalSaved: (childId: string) => number;
  getGoalProgress: (goalId: string) => number; // 0–100
}

type SavingsStore = SavingsState & SavingsActions;

// ── Datos de demo (pre-cargados) ──────────────────────────────────────────────

const DEMO_GOALS: SavingsGoal[] = [
  // Ivonne (child_001) - Proyectos Grandes
  { id: 'goal_001', childId: 'child_001', source: 'parent', title: 'iPad Pro para estudiar', emoji: '📱', description: 'Meta compartida: papá pone el 50% si ahorras el resto.', targetAmount: 2800000, currentAmount: 1250000, frequency: 'total', category: 'electronics', createdAt: Date.now() - 86400000 * 30 },
  { id: 'goal_002', childId: 'child_001', source: 'child', title: 'Viaje con amigas', emoji: '🎢', description: 'Ahorro para el parque de diversiones en verano.', targetAmount: 450000, currentAmount: 85000, frequency: 'weekly', category: 'trip', createdAt: Date.now() - 86400000 * 10 },
  
  // Hernando (child_002) - Juguetes y hobbies
  { id: 'goal_003', childId: 'child_002', source: 'parent', title: 'Colección LEGO Technic', emoji: '🏗️', description: 'Papá te premia por tu constancia.', targetAmount: 680000, currentAmount: 420000, frequency: 'monthly', category: 'toy', createdAt: Date.now() - 86400000 * 45 },
  { id: 'goal_004', childId: 'child_002', source: 'child', title: 'Skin de Fortnite', emoji: '🎮', description: '¡Casi lo logro!', targetAmount: 45000, currentAmount: 38000, frequency: 'total', category: 'toy', createdAt: Date.now() - 86400000 * 5 },

  // Salomé (child_003) - Metas financieras serias
  { id: 'goal_005', childId: 'child_003', source: 'parent', title: 'Fondo para Computador', emoji: '💻', description: 'Inversión para tu educación superior.', targetAmount: 4500000, currentAmount: 1850000, frequency: 'total', category: 'education', createdAt: Date.now() - 86400000 * 60 },
  { id: 'goal_006', childId: 'child_003', source: 'child', title: 'Primer Concierto', emoji: '🎸', description: 'Ahorro para la boleta de mi banda favorita.', targetAmount: 350000, currentAmount: 320000, frequency: 'weekly', category: 'custom', createdAt: Date.now() - 86400000 * 15 },
];

const DEMO_DEPOSITS: SavingsDeposit[] = [
  // Pendientes (Acción requerida para el padre)
  { id: 'dep_001', childId: 'child_001', goalId: 'goal_001', amount: 85000, description: 'Dinero de mi cumpleaños', status: 'pending', submittedAt: Date.now() - 3600000 * 2, receiptNote: 'Está en el sobre rojo en mi escritorio' },
  { id: 'dep_002', childId: 'child_001', amount: 12000, description: 'Venta de pulseras', status: 'pending', submittedAt: Date.now() - 3600000 * 5, receiptNote: 'Lo tengo en monedas' },
  { id: 'dep_003', childId: 'child_002', goalId: 'goal_004', amount: 5000, description: 'Por lavar los platos', status: 'pending', submittedAt: Date.now() - 3600000 * 1, receiptNote: 'En mi alcancía de sapito' },
  { id: 'dep_004', childId: 'child_003', goalId: 'goal_006', amount: 45000, description: 'Trabajo de fin de semana', status: 'pending', submittedAt: Date.now() - 3600000 * 12, receiptNote: 'Bajo el teclado' },

  // Algunos aprobados previos para historia y balance
  { id: 'dep_h1', childId: 'child_001', goalId: 'goal_001', amount: 1165000, description: 'Ahorros acumulados', status: 'approved', submittedAt: Date.now() - 86400000 * 20, reviewedAt: Date.now() - 86400000 * 19 },
  { id: 'dep_h2', childId: 'child_002', goalId: 'goal_003', amount: 420000, description: 'Regalo Navidad + Ahorros', status: 'approved', submittedAt: Date.now() - 86400000 * 40, reviewedAt: Date.now() - 86400000 * 39 },
  { id: 'dep_h3', childId: 'child_003', goalId: 'goal_005', amount: 1850000, description: 'Beca + Ahorros', status: 'approved', submittedAt: Date.now() - 86400000 * 50, reviewedAt: Date.now() - 86400000 * 49 },
];

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
        set(s => ({ goals: [...s.goals, goal] }));
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
        set(s => ({ deposits: [...s.deposits, deposit] }));
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
        set(s => ({ goals: [...s.goals, goal] }));
      },

      approveDeposit: (depositId, note) => {
        set(s => {
          const deposit = s.deposits.find(d => d.id === depositId);
          if (!deposit || deposit.status !== 'pending') return s;

          // Actualizar el monto en la meta correspondiente
          const updatedGoals = deposit.goalId
            ? s.goals.map(g =>
                g.id === deposit.goalId
                  ? { ...g, currentAmount: g.currentAmount + deposit.amount }
                  : g
              )
            : s.goals;

          return {
            deposits: s.deposits.map(d =>
              d.id === depositId
                ? { ...d, status: 'approved' as DepositStatus, reviewedAt: Date.now(), parentNote: note }
                : d
            ),
            goals: updatedGoals,
          };
        });
      },

      rejectDeposit: (depositId, note) => {
        set(s => ({
          deposits: s.deposits.map(d =>
            d.id === depositId
              ? { ...d, status: 'rejected' as DepositStatus, reviewedAt: Date.now(), parentNote: note }
              : d
          ),
        }));
      },

      removeGoal: (goalId) => {
        set(s => ({ goals: s.goals.filter(g => g.id !== goalId) }));
      },

      // ── Queries ────────────────────────────────────────────────────────────

      getGoalsForChild: (childId) =>
        get().goals.filter(g => g.childId === childId),

      getParentGoalsForChild: (childId) =>
        get().goals.filter(g => g.childId === childId && g.source === 'parent'),

      getPendingDeposits: (childId) =>
        get().deposits.filter(d =>
          d.status === 'pending' && (childId ? d.childId === childId : true)
        ),

      getApprovedDeposits: (childId) =>
        get().deposits.filter(d => d.childId === childId && d.status === 'approved'),

      getTotalSaved: (childId) =>
        get().deposits
          .filter(d => d.childId === childId && d.status === 'approved')
          .reduce((acc, d) => acc + d.amount, 0),

      getGoalProgress: (goalId) => {
        const goal = get().goals.find(g => g.id === goalId);
        if (!goal || goal.targetAmount === 0) return 0;
        return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
      },
    }),
    {
      name: 'savings-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
