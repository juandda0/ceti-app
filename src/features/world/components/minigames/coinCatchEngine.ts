// coinCatchEngine.ts — Lógica pura del minijuego Coin Catch (sin React, testeable)

export type CoinType = 'ceti' | 'bonus' | 'expense';

export interface Coin {
  id: number;
  x: number; // posición en pantalla (0–1 de ancho)
  y: number; // posición vertical (px)
  speed: number; // px por frame
  type: CoinType;
  caught: boolean;
  missed: boolean;
}

export interface EngineConfig {
  width: number;
  height: number;
  gameDuration: number; // ms
  spawnIntervalMs: number;
  bonusIntervalMs: number;
}

export interface EngineState {
  coins: Coin[];
  score: number;
  timeElapsedMs: number;
  bonusSpawned: boolean;
  nextId: number;
}

export const SCORE_PER_CETI = 1;
export const SCORE_PER_BONUS = 5;
export const SCORE_PENALTY_EXPENSE = 2;

export const CETIS_REWARD_TIER_1 = { minScore: 30, cetis: 25 };
export const CETIS_REWARD_TIER_2 = { minScore: 60, cetis: 50 };
export const CETIS_REWARD_TIER_3 = { minScore: 100, cetis: 100 };

export const COOLDOWN_MS = 60 * 60 * 1000; // 1 hora

/** Crea el estado inicial del engine */
export function createInitialState(): EngineState {
  return {
    coins: [],
    score: 0,
    timeElapsedMs: 0,
    bonusSpawned: false,
    nextId: 1,
  };
}

/** Spawn de una moneda nueva */
export function spawnCoin(
  state: EngineState,
  config: EngineConfig,
  dtMs: number,
  isBonus: boolean = false
): EngineState {
  'worklet';
  const type: CoinType = isBonus ? 'bonus' : Math.random() < 0.25 ? 'expense' : 'ceti';
  const speedFactor = 1 + (state.timeElapsedMs / config.gameDuration) * 1.8; // velocidad crece con el tiempo
  const coin: Coin = {
    id: state.nextId,
    x: 0.05 + Math.random() * 0.9,
    y: -40,
    speed: (2.5 + Math.random() * 2.0) * speedFactor,
    type,
    caught: false,
    missed: false,
  };
  return {
    ...state,
    coins: [...state.coins, coin],
    nextId: state.nextId + 1,
  };
}

/** Actualiza posiciones en cada frame */
export function tickEngine(
  state: EngineState,
  config: EngineConfig,
  dtMs: number,
  lastSpawnMs: number,
  lastBonusMs: number
): {
  state: EngineState;
  shouldSpawn: boolean;
  shouldSpawnBonus: boolean;
} {
  'worklet';
  const elapsed = state.timeElapsedMs + dtMs;
  const shouldSpawn = elapsed - lastSpawnMs >= config.spawnIntervalMs;
  const shouldSpawnBonus = !state.bonusSpawned && elapsed - lastBonusMs >= config.bonusIntervalMs;

  const updatedCoins = state.coins.map((c) => {
    if (c.caught || c.missed) return c;
    const newY = c.y + c.speed;
    return { ...c, y: newY, missed: newY >= config.height };
  });

  return {
    state: { ...state, coins: updatedCoins, timeElapsedMs: elapsed },
    shouldSpawn,
    shouldSpawnBonus,
  };
}

/** Tap del jugador en posición (tapX, tapY) en px */
export function tapCoin(
  state: EngineState,
  tapX: number,
  tapY: number,
  screenWidth: number,
  coinRadius: number = 28
): { state: EngineState; caught: Coin | null } {
  'worklet';
  let caught: Coin | null = null;

  const updatedCoins = state.coins.map((c) => {
    if (c.caught || c.missed || caught) return c;
    const cx = c.x * screenWidth;
    const dist = Math.sqrt((cx - tapX) ** 2 + (c.y - tapY) ** 2);
    if (dist <= coinRadius) {
      caught = c;
      return { ...c, caught: true };
    }
    return c;
  });

  if (!caught) return { state, caught: null };

  const delta =
    (caught as Coin).type === 'ceti'
      ? SCORE_PER_CETI
      : (caught as Coin).type === 'bonus'
        ? SCORE_PER_BONUS
        : -SCORE_PENALTY_EXPENSE;

  const newScore = Math.max(0, state.score + delta);
  const bonusSpawned = state.bonusSpawned || (caught as Coin).type === 'bonus';

  return {
    state: { ...state, coins: updatedCoins, score: newScore, bonusSpawned },
    caught,
  };
}

/** Calcula recompensa de Cetis por score final */
export function calcReward(score: number): { cetis: number; tier: 0 | 1 | 2 | 3 } {
  if (score >= CETIS_REWARD_TIER_3.minScore) return { cetis: CETIS_REWARD_TIER_3.cetis, tier: 3 };
  if (score >= CETIS_REWARD_TIER_2.minScore) return { cetis: CETIS_REWARD_TIER_2.cetis, tier: 2 };
  if (score >= CETIS_REWARD_TIER_1.minScore) return { cetis: CETIS_REWARD_TIER_1.cetis, tier: 1 };
  return { cetis: 0, tier: 0 };
}
