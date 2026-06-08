/**
 * Life-project savings (V2) — simulated, virtual-currency only (no real money).
 * Templates seed common "proyecto de vida" goals, and the projection helpers turn
 * a target into a financial-planning lesson: "save ~X/month → reach it in N
 * months". Pure & testable; no schema change to the savings store.
 */
import type { GoalCategory } from '@features/savings/store/useSavingsStore';

export interface LifeProjectTemplate {
  id: string;
  /** i18n key for the display title. */
  titleKey: string;
  emoji: string;
  category: GoalCategory;
  /** Suggested target amount (virtual currency). */
  suggestedTarget: number;
}

export const LIFE_PROJECT_TEMPLATES: LifeProjectTemplate[] = [
  {
    id: 'education',
    titleKey: 'goals.tplEducation',
    emoji: '🎓',
    category: 'education',
    suggestedTarget: 500,
  },
  {
    id: 'tech',
    titleKey: 'goals.tplTech',
    emoji: '💻',
    category: 'electronics',
    suggestedTarget: 1000,
  },
  { id: 'trip', titleKey: 'goals.tplTrip', emoji: '✈️', category: 'trip', suggestedTarget: 800 },
  {
    id: 'emergency',
    titleKey: 'goals.tplEmergency',
    emoji: '🛟',
    category: 'emergency',
    suggestedTarget: 300,
  },
  {
    id: 'business',
    titleKey: 'goals.tplBusiness',
    emoji: '🚀',
    category: 'custom',
    suggestedTarget: 1200,
  },
];

/**
 * Months of contributions needed to reach the target at `monthly` per month.
 * Returns null when `monthly` is not positive (can't project), and 0 when the
 * goal is already reached.
 */
export function monthsToReach(target: number, current: number, monthly: number): number | null {
  if (monthly <= 0) return null;
  const remaining = target - current;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / monthly);
}

/**
 * Suggested monthly contribution to cover the remaining amount within
 * `horizonMonths` (default one year). Never negative.
 */
export function suggestMonthly(target: number, current: number, horizonMonths = 12): number {
  const remaining = Math.max(0, target - current);
  if (horizonMonths <= 0) return remaining;
  return Math.ceil(remaining / horizonMonths);
}
