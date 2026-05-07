// CoinCatchGame.tsx — Minijuego Coin Catch: motor en UI thread + SharedValues
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import { Spacing } from '@shared/constants/theme';
import CetiButton from '@shared/components/CetiButton';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import { useWorldStore } from '../../store/useWorldStore';
import {
  createInitialState,
  spawnCoin,
  tapCoin,
  tickEngine,
  calcReward,
  COOLDOWN_MS,
  type Coin,
  type EngineState,
  type EngineConfig,
} from './coinCatchEngine';
import { logEvent } from '@shared/lib/analytics/logEvent';

const { width: SW, height: SH } = Dimensions.get('window');

const GAME_DURATION_MS = 30000;
const SPAWN_INTERVAL_MS = 900;
const BONUS_INTERVAL_MS = 14000;
const COIN_RADIUS = 30;
const TICK_MS = 33;
const VISIBLE_SLOTS = 26;

const ENGINE_CONFIG: EngineConfig = {
  width: SW,
  height: SH,
  gameDuration: GAME_DURATION_MS,
  spawnIntervalMs: SPAWN_INTERVAL_MS,
  bonusIntervalMs: BONUS_INTERVAL_MS,
};

type Phase = 'idle' | 'countdown' | 'playing' | 'result';

const COUNTDOWN_SECONDS = 3;

interface CoinCatchGameProps {
  visible: boolean;
  onClose: () => void;
}

function makeEmptyVisible(): (Coin | null)[] {
  const a: (Coin | null)[] = [];
  for (let i = 0; i < VISIBLE_SLOTS; i++) a.push(null);
  return a;
}

function compactVisibleCoins(engine: EngineState, slots: number): (Coin | null)[] {
  'worklet';
  const out: (Coin | null)[] = [];
  for (let i = 0; i < slots; i++) out.push(null);
  let j = 0;
  for (let i = 0; i < engine.coins.length && j < slots; i++) {
    const c = engine.coins[i];
    if (!c.caught && !c.missed) {
      out[j] = c;
      j += 1;
    }
  }
  return out;
}

function CoinSlot({ index, visibleSV }: { index: number; visibleSV: { value: (Coin | null)[] } }) {
  const colors = {
    ceti: '#F7C95F',
    bonus: '#FF9900',
    expense: '#F06676',
  };

  const style = useAnimatedStyle(() => {
    const c = visibleSV.value[index];
    if (!c || c.caught || c.missed) {
      return { opacity: 0, transform: [{ translateX: -9999 }] };
    }
    return {
      opacity: 1,
      left: c.x * SW - COIN_RADIUS,
      top: c.y - COIN_RADIUS,
      width: COIN_RADIUS * 2,
      height: COIN_RADIUS * 2,
      backgroundColor:
        c.type === 'bonus' ? '#FF6600' : c.type === 'expense' ? '#801020' : '#3A2800',
      borderColor: colors[c.type],
      transform: c.type === 'bonus' ? [{ scale: 1.25 }] : [],
      position: 'absolute' as const,
      borderRadius: 999,
      borderWidth: 2,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    };
  });

  const cetiStyle = useAnimatedStyle(() => {
    const c = visibleSV.value[index];
    const on = c && !c.caught && !c.missed && c.type === 'ceti';
    return { opacity: on ? 1 : 0, position: 'absolute' as const };
  });
  const bonusStyle = useAnimatedStyle(() => {
    const c = visibleSV.value[index];
    const on = c && !c.caught && !c.missed && c.type === 'bonus';
    return { opacity: on ? 1 : 0, position: 'absolute' as const };
  });
  const expenseStyle = useAnimatedStyle(() => {
    const c = visibleSV.value[index];
    const on = c && !c.caught && !c.missed && c.type === 'expense';
    return { opacity: on ? 1 : 0, position: 'absolute' as const };
  });

  return (
    <Animated.View pointerEvents="none" style={style}>
      <Animated.View style={cetiStyle}>
        <Ionicons name="cash" size={20} color={colors.ceti} />
      </Animated.View>
      <Animated.View style={bonusStyle}>
        <Ionicons name="star" size={26} color={colors.bonus} />
      </Animated.View>
      <Animated.View style={expenseStyle}>
        <Ionicons name="receipt" size={20} color={colors.expense} />
      </Animated.View>
    </Animated.View>
  );
}

export default function CoinCatchGame({ visible, onClose }: CoinCatchGameProps) {
  const colors = useThemeColors();
  const earnCetis = useWalletStore((s) => s.earnCetis);
  const setMinigameCooldown = useWorldStore((s) => s.setMinigameCooldown);

  const [phase, setPhase] = useState<Phase>('idle');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_MS / 1000);
  const [displayScore, setDisplayScore] = useState(0);
  const [reward, setReward] = useState<{ cetis: number; tier: 0 | 1 | 2 | 3 }>({
    cetis: 0,
    tier: 0,
  });

  const engineSV = useSharedValue<EngineState>({
    coins: [],
    score: 0,
    timeElapsedMs: 0,
    bonusSpawned: false,
    nextId: 1,
  });
  const lastSpawnSV = useSharedValue(0);
  const lastBonusSV = useSharedValue(0);
  const isPlayingSV = useSharedValue(false);
  const visibleSV = useSharedValue<(Coin | null)[]>(makeEmptyVisible());
  const lastHudTsSV = useSharedValue(0);

  const pushHud = useCallback((score: number, secs: number) => {
    setDisplayScore(score);
    setTimeLeft(secs);
  }, []);

  const frameLoopRef = React.useRef<{ setActive: (v: boolean) => void } | null>(null);

  const finalizeGame = useCallback(() => {
    frameLoopRef.current?.setActive(false);
    const finalState = engineSV.value;
    const r = calcReward(finalState.score);
    setReward(r);
    if (r.cetis > 0) {
      earnCetis(r.cetis, 'Coin Catch', 'lesson');
    }
    setMinigameCooldown('coinCatch', Date.now() + COOLDOWN_MS);
    void logEvent('minigame_complete', {
      game: 'coin_catch',
      score: finalState.score,
      cetis_earned: r.cetis,
    });
    setPhase('result');
  }, [earnCetis, setMinigameCooldown, engineSV]);

  const hapticForTap = useCallback((t: Coin['type']) => {
    void Haptics.impactAsync(
      t === 'bonus'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : t === 'expense'
          ? Haptics.ImpactFeedbackStyle.Rigid
          : Haptics.ImpactFeedbackStyle.Light
    );
  }, []);

  const onFrame = useCallback(
    (frame: { timestamp: number; timeSincePreviousFrame: number | null }) => {
      'worklet';
      if (!isPlayingSV.value) return;
      const dt = Math.min(frame.timeSincePreviousFrame ?? TICK_MS, 64);
      let s = engineSV.value;

      const ticked = tickEngine(s, ENGINE_CONFIG, dt, lastSpawnSV.value, lastBonusSV.value);
      s = ticked.state;
      if (ticked.shouldSpawn) {
        s = spawnCoin(s, ENGINE_CONFIG, dt, false);
        lastSpawnSV.value = s.timeElapsedMs;
      }
      if (ticked.shouldSpawnBonus) {
        s = spawnCoin(s, ENGINE_CONFIG, dt, true);
        lastBonusSV.value = s.timeElapsedMs;
        s = { ...s, bonusSpawned: true };
      }
      engineSV.value = s;
      visibleSV.value = compactVisibleCoins(s, VISIBLE_SLOTS);

      if (s.timeElapsedMs >= GAME_DURATION_MS) {
        isPlayingSV.value = false;
        runOnJS(finalizeGame)();
        return;
      }

      const ts = frame.timestamp;
      if (ts - lastHudTsSV.value > 90) {
        lastHudTsSV.value = ts;
        const secs = Math.max(0, Math.ceil((GAME_DURATION_MS - s.timeElapsedMs) / 1000));
        runOnJS(pushHud)(s.score, secs);
      }
    },
    [finalizeGame, pushHud]
  );

  const frameLoop = useFrameCallback(onFrame, false);

  useEffect(() => {
    frameLoopRef.current = frameLoop;
  }, [frameLoop]);

  const tapGesture = Gesture.Tap().onEnd((e) => {
    'worklet';
    if (!isPlayingSV.value) return;
    const res = tapCoin(engineSV.value, e.x, e.y, SW, COIN_RADIUS);
    engineSV.value = res.state;
    visibleSV.value = compactVisibleCoins(res.state, VISIBLE_SLOTS);
    if (res.caught) {
      const secs = Math.max(0, Math.ceil((GAME_DURATION_MS - res.state.timeElapsedMs) / 1000));
      runOnJS(pushHud)(res.state.score, secs);
      runOnJS(hapticForTap)(res.caught.type);
    }
  });

  const countdownTimerRef = React.useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const startGame = useCallback(() => {
    engineSV.value = createInitialState();
    lastSpawnSV.value = 0;
    lastBonusSV.value = 0;
    lastHudTsSV.value = 0;
    visibleSV.value = makeEmptyVisible();
    setDisplayScore(0);
    setTimeLeft(GAME_DURATION_MS / 1000);
    setPhase('playing');
    isPlayingSV.value = true;
    frameLoop.setActive(true);
  }, [engineSV, frameLoop, isPlayingSV, lastBonusSV, lastHudTsSV, lastSpawnSV, visibleSV]);

  const startGameRef = React.useRef(startGame);
  startGameRef.current = startGame;

  const startCountdown = useCallback(() => {
    setPhase('countdown');
    setCountdown(COUNTDOWN_SECONDS);
    let c = COUNTDOWN_SECONDS;
    clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(countdownTimerRef.current);
        startGameRef.current();
      }
    }, 1000);
  }, []);

  const handleClose = useCallback(() => {
    clearInterval(countdownTimerRef.current);
    isPlayingSV.value = false;
    frameLoop.setActive(false);
    setPhase('idle');
    onClose();
  }, [frameLoop, isPlayingSV, onClose]);

  useEffect(() => {
    if (!visible) {
      clearInterval(countdownTimerRef.current);
      isPlayingSV.value = false;
      frameLoop.setActive(false);
      setPhase('idle');
    }
  }, [visible, frameLoop, isPlayingSV]);

  const tierLabels = ['', 'Buen intento', '¡Excelente!', '¡Maestro Ceti!'];
  const tierColors = ['', colors.system.blue, colors.gold.primary, colors.brand.primary];

  const slots = React.useMemo(() => Array.from({ length: VISIBLE_SLOTS }, (_, i) => i), []);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <SafeAreaView
        style={[styles.root, { backgroundColor: '#01040F' }]}
        edges={['top', 'right', 'bottom', 'left']}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="cash" size={20} color={colors.gold.primary} />
            <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Coin Catch</Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={12} accessibilityLabel="Cerrar juego">
            <Ionicons name="close" size={26} color={colors.text.secondary} />
          </Pressable>
        </View>

        {phase === 'playing' && (
          <View style={styles.hud}>
            <View style={[styles.hudPill, { backgroundColor: colors.background.elevated }]}>
              <Ionicons name="sparkles" size={14} color={colors.gold.primary} />
              <Text style={[styles.hudText, { color: colors.gold.primary }]}>
                {displayScore} pts
              </Text>
            </View>
            <View style={[styles.hudPill, { backgroundColor: colors.background.elevated }]}>
              <Ionicons name="time-outline" size={14} color={colors.text.secondary} />
              <Text style={[styles.hudText, { color: colors.text.secondary }]}>{timeLeft}s</Text>
            </View>
          </View>
        )}

        {phase === 'playing' && (
          <GestureDetector gesture={tapGesture}>
            <View style={styles.gameArea}>
              {slots.map((i) => (
                <CoinSlot key={i} index={i} visibleSV={visibleSV} />
              ))}
            </View>
          </GestureDetector>
        )}

        {phase === 'idle' && (
          <View style={styles.centeredBlock}>
            <Ionicons name="cash" size={64} color={colors.gold.primary} />
            <Text style={[styles.bigTitle, { color: colors.text.primary }]}>Coin Catch</Text>
            <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
              Toca los Cetis dorados para ganar puntos.{'\n'}
              Evita las facturas rojas o perderás puntos.{'\n'}
              El Ceti naranja grande vale 5 puntos.
            </Text>
            <View style={styles.rewardTable}>
              {[
                { min: 30, cetis: 25 },
                { min: 60, cetis: 50 },
                { min: 100, cetis: 100 },
              ].map((t) => (
                <View
                  key={t.min}
                  style={[styles.rewardRow, { backgroundColor: colors.background.elevated }]}
                >
                  <Text style={[styles.rewardLabel, { color: colors.text.secondary }]}>
                    {t.min}+ pts
                  </Text>
                  <View style={styles.rewardRight}>
                    <Ionicons name="sparkles" size={14} color={colors.gold.primary} />
                    <Text style={[styles.rewardValue, { color: colors.gold.primary }]}>
                      +{t.cetis} Cetis
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <CetiButton
              label="Jugar"
              onPress={startCountdown}
              variant="primary"
              size="large"
              style={styles.ctaBtn}
              backgroundColor={colors.brand.primary}
            />
          </View>
        )}

        {phase === 'countdown' && (
          <View style={styles.centeredBlock}>
            <Text style={[styles.countdownNumber, { color: colors.brand.primary }]}>
              {countdown}
            </Text>
            <Text style={[styles.subtitle, { color: colors.text.secondary }]}>¡Prepárate!</Text>
          </View>
        )}

        {phase === 'result' && (
          <View style={styles.centeredBlock}>
            <Ionicons
              name={reward.tier >= 2 ? 'trophy' : 'star-outline'}
              size={64}
              color={tierColors[reward.tier] || colors.text.secondary}
            />
            <Text style={[styles.bigTitle, { color: colors.text.primary }]}>
              {displayScore} puntos
            </Text>
            {reward.tier > 0 && (
              <Text style={[styles.tierLabel, { color: tierColors[reward.tier] }]}>
                {tierLabels[reward.tier]}
              </Text>
            )}
            {reward.cetis > 0 ? (
              <View style={[styles.cetisEarned, { backgroundColor: colors.background.elevated }]}>
                <Ionicons name="sparkles" size={20} color={colors.gold.primary} />
                <Text style={[styles.cetisEarnedText, { color: colors.gold.primary }]}>
                  +{reward.cetis} Cetis ganados
                </Text>
              </View>
            ) : (
              <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>
                Necesitas 30 pts para ganar Cetis.{'\n'}¡Inténtalo de nuevo en 1 hora!
              </Text>
            )}
            <CetiButton
              label="Cerrar"
              onPress={handleClose}
              variant="secondary"
              size="large"
              style={styles.ctaBtn}
              backgroundColor={colors.background.elevated}
            />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { ...Typography.title3, fontWeight: '800' },
  hud: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  hudPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  hudText: { fontSize: 14, fontWeight: '800' },
  gameArea: {
    flex: 1,
    position: 'relative',
  },
  centeredBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.md,
  },
  bigTitle: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  countdownNumber: {
    fontSize: 96,
    fontWeight: '900',
    letterSpacing: -4,
  },
  tierLabel: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  cetisEarned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    marginVertical: 8,
  },
  cetisEarnedText: {
    fontSize: 20,
    fontWeight: '900',
  },
  rewardTable: { width: '100%', gap: 8, marginVertical: 8 },
  rewardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  rewardLabel: { fontSize: 14, fontWeight: '600' },
  rewardRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rewardValue: { fontSize: 14, fontWeight: '800' },
  ctaBtn: { width: '100%', marginTop: Spacing.sm },
});
