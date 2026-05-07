import { didLevelUp, getMaxLevel, getStreakBonusXP, XP_REWARDS } from '@shared/utils/xp';

describe('xp utils', () => {
  describe('didLevelUp', () => {
    it('detects cuando el nivel sube', () => {
      expect(didLevelUp(0, 150)).toBe(true);
    });

    it('false cuando sigue en el mismo nivel', () => {
      expect(didLevelUp(50, 99)).toBe(false);
    });
  });

  describe('getMaxLevel', () => {
    it('coincide con el último nivel definido', () => {
      expect(getMaxLevel()).toBe(5);
    });
  });

  describe('getStreakBonusXP', () => {
    it('bonifica en 3 y 7 días', () => {
      expect(getStreakBonusXP(3)).toBe(XP_REWARDS.STREAK_DAY_3);
      expect(getStreakBonusXP(7)).toBe(XP_REWARDS.STREAK_DAY_7);
    });

    it('no bonifica otros valores', () => {
      expect(getStreakBonusXP(0)).toBe(0);
      expect(getStreakBonusXP(5)).toBe(0);
    });
  });
});
