import {
  createInitialState,
  spawnCoin,
  tapCoin,
  tickEngine,
  calcReward,
  SCORE_PER_CETI,
  SCORE_PER_BONUS,
  SCORE_PENALTY_EXPENSE,
  CETIS_REWARD_TIER_1,
  CETIS_REWARD_TIER_2,
  CETIS_REWARD_TIER_3,
  type EngineConfig,
} from './coinCatchEngine';

const CONFIG: EngineConfig = {
  width: 375,
  height: 812,
  gameDuration: 30000,
  spawnIntervalMs: 900,
  bonusIntervalMs: 15000,
};

describe('coinCatchEngine', () => {
  describe('createInitialState', () => {
    it('empieza con score 0 y sin monedas', () => {
      const s = createInitialState();
      expect(s.score).toBe(0);
      expect(s.coins).toHaveLength(0);
      expect(s.timeElapsedMs).toBe(0);
      expect(s.bonusSpawned).toBe(false);
    });
  });

  describe('spawnCoin', () => {
    it('agrega una moneda al estado', () => {
      const s = spawnCoin(createInitialState(), CONFIG, 0);
      expect(s.coins).toHaveLength(1);
      expect(s.nextId).toBe(2);
    });

    it('spawn de bonus crea moneda tipo bonus', () => {
      const s = spawnCoin(createInitialState(), CONFIG, 0, true);
      expect(s.coins[0].type).toBe('bonus');
    });

    it('la moneda empieza encima del canvas (y negativa)', () => {
      const s = spawnCoin(createInitialState(), CONFIG, 0);
      expect(s.coins[0].y).toBeLessThan(0);
    });
  });

  describe('tapCoin', () => {
    it('atrapar un ceti suma SCORE_PER_CETI', () => {
      let s = createInitialState();
      // forzar moneda tipo ceti en posición conocida
      s = {
        ...s,
        coins: [{ id: 1, x: 0.5, y: 200, speed: 3, type: 'ceti', caught: false, missed: false }],
      };
      const { state, caught } = tapCoin(s, 375 * 0.5, 200, CONFIG.width);
      expect(caught).not.toBeNull();
      expect(state.score).toBe(SCORE_PER_CETI);
    });

    it('atrapar un bonus suma SCORE_PER_BONUS', () => {
      let s = createInitialState();
      s = {
        ...s,
        coins: [{ id: 1, x: 0.5, y: 200, speed: 3, type: 'bonus', caught: false, missed: false }],
      };
      const { state } = tapCoin(s, 375 * 0.5, 200, CONFIG.width);
      expect(state.score).toBe(SCORE_PER_BONUS);
    });

    it('atrapar un expense resta SCORE_PENALTY_EXPENSE (floor en 0)', () => {
      let s = createInitialState();
      s = {
        ...s,
        coins: [{ id: 1, x: 0.5, y: 200, speed: 3, type: 'expense', caught: false, missed: false }],
      };
      const { state } = tapCoin(s, 375 * 0.5, 200, CONFIG.width);
      expect(state.score).toBe(0); // no va negativo
    });

    it('tap fuera del radio no captura nada', () => {
      let s = createInitialState();
      s = {
        ...s,
        coins: [{ id: 1, x: 0.5, y: 200, speed: 3, type: 'ceti', caught: false, missed: false }],
      };
      const { caught } = tapCoin(s, 0, 0, CONFIG.width); // lejos
      expect(caught).toBeNull();
    });
  });

  describe('tickEngine', () => {
    it('avanza el tiempo elapsed', () => {
      const { state } = tickEngine(createInitialState(), CONFIG, 16, 0, 0);
      expect(state.timeElapsedMs).toBe(16);
    });

    it('las monedas se mueven hacia abajo', () => {
      let s = createInitialState();
      s = {
        ...s,
        coins: [{ id: 1, x: 0.5, y: 100, speed: 5, type: 'ceti', caught: false, missed: false }],
      };
      const { state } = tickEngine(s, CONFIG, 16, 9999, 9999);
      expect(state.coins[0].y).toBeGreaterThan(100);
    });

    it('marca moneda como missed si supera la altura', () => {
      let s = createInitialState();
      s = {
        ...s,
        coins: [
          {
            id: 1,
            x: 0.5,
            y: CONFIG.height - 2,
            speed: 5,
            type: 'ceti',
            caught: false,
            missed: false,
          },
        ],
      };
      const { state } = tickEngine(s, CONFIG, 16, 9999, 9999);
      expect(state.coins[0].missed).toBe(true);
    });
  });

  describe('calcReward', () => {
    it('score 0 → 0 Cetis, tier 0', () => {
      expect(calcReward(0)).toEqual({ cetis: 0, tier: 0 });
    });
    it(`score ${CETIS_REWARD_TIER_1.minScore} → tier 1`, () => {
      expect(calcReward(CETIS_REWARD_TIER_1.minScore)).toEqual({
        cetis: CETIS_REWARD_TIER_1.cetis,
        tier: 1,
      });
    });
    it(`score ${CETIS_REWARD_TIER_2.minScore} → tier 2`, () => {
      expect(calcReward(CETIS_REWARD_TIER_2.minScore)).toEqual({
        cetis: CETIS_REWARD_TIER_2.cetis,
        tier: 2,
      });
    });
    it(`score ${CETIS_REWARD_TIER_3.minScore} → tier 3`, () => {
      expect(calcReward(CETIS_REWARD_TIER_3.minScore)).toEqual({
        cetis: CETIS_REWARD_TIER_3.cetis,
        tier: 3,
      });
    });
  });
});
