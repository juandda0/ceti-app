// WorldScreen.tsx — Pantalla principal 2D del mundo de Ceti
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useChildStore } from '@features/auth/store/useChildStore';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import { useWorldStore } from '@features/world/store/useWorldStore';
import { useRewards } from '@shared/hooks/useRewards';
import { useReduceMotionShared } from '@shared/hooks/useReduceMotionShared';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { getLocalCalendarYMD, getLocalCalendarYMDDaysAgo } from '@shared/utils/calendarDate';
import { logEvent } from '@shared/lib/analytics/logEvent';
import { WORLDS, getNextWorld } from '@features/world/data/worlds';
import WorldCanvas from '@features/world/components/WorldCanvas';
import type { WorldCanvasHandle } from '@features/world/components/WorldCanvas';
import WorldOverlay from '@features/world/components/WorldOverlay';
import WorldRocket from '@features/world/components/WorldRocket';
import WorldUnlockSheet from '@features/world/components/WorldUnlockSheet';
import WorldRocketLoader from '@features/world/components/WorldRocketLoader';
import LevelUpModal from '@features/world/components/LevelUpModal';
import CoinCatchGame from '@features/world/components/minigames/CoinCatchGame';
import SaveOrSpendGame from '@features/world/components/minigames/SaveOrSpendGame';
import { useSharedValue } from 'react-native-reanimated';

const AVATAR_MAP: Record<string, string> = {
  avatar_1: '🦁',
  avatar_2: '🐸',
  avatar_3: '🦊',
  avatar_4: '🐼',
  avatar_5: '🐱',
  avatar_6: '🐶',
  avatar_7: '🦄',
  avatar_8: '🐨',
};

export default function WorldScreen() {
  const {
    nickname,
    xp,
    avatarId,
    streak,
    level,
    lastCelebratedLevel,
    celebrateLevel,
    isOnboarded,
    lastStreakMissionDate,
  } = useChildStore();

  const totalCetis = useWalletStore((s) => s.totalCetis);
  const spendCetis = useWalletStore((s) => s.spendCetis);
  const currentWorldId = useWorldStore((s) => s.currentWorldId);
  const unlockWorld = useWorldStore((s) => s.unlockWorld);
  const travelTo = useWorldStore((s) => s.travelTo);
  const minigameCooldowns = useWorldStore((s) => s.minigameCooldowns);

  const colors = useThemeColors();
  const { checkAll } = useRewards();
  const { reduceMotion } = useReduceMotionShared();

  const [showUnlockSheet, setShowUnlockSheet] = useState(false);
  const [traveling, setTraveling] = useState(false);
  const [showCoinCatch, setShowCoinCatch] = useState(false);
  const [showSaveOrSpend, setShowSaveOrSpend] = useState(false);

  // Ref al canvas para leer bobOffset / flameScale del cohete Skia
  const canvasRef = useRef<WorldCanvasHandle>(null);
  // Fallback SharedValue por si el ref aún no está inicializado
  const fallbackBob = useSharedValue(0);

  useEffect(() => {
    if (isOnboarded) {
      checkAll();
    }
  }, [level, streak, totalCetis, isOnboarded]);

  if (!isOnboarded) return null;

  const nextWorld = getNextWorld(currentWorldId);
  const canTravel = nextWorld !== null && totalCetis >= nextWorld.costCetis;

  const showLevelUp = level > lastCelebratedLevel;
  const avatarEmoji = AVATAR_MAP[avatarId] ?? '';
  const today = getLocalCalendarYMD();
  const yesterday = getLocalCalendarYMDDaysAgo(1);
  const isStreakActive = lastStreakMissionDate === today || lastStreakMissionDate === yesterday;

  function handleRocketTap() {
    setShowUnlockSheet(true);
  }

  function handleConfirmTravel() {
    if (!nextWorld) return;
    const ok = spendCetis(nextWorld.costCetis, `Viaje a ${nextWorld.name}`);
    if (!ok) return;
    setShowUnlockSheet(false);
    setTraveling(true);
    void logEvent('world_travel', {
      from_world: currentWorldId,
      to_world: nextWorld.id,
      cetis_spent: nextWorld.costCetis,
    });
  }

  function handleArrive() {
    if (!nextWorld) return;
    unlockWorld(nextWorld.id);
    travelTo(nextWorld.id);
    setTraveling(false);
    void logEvent('world_unlocked', { world_id: nextWorld.id });
  }

  return (
    <ScreenWrapper style={[styles.container, { backgroundColor: colors.background.base }]}>
      {/* Layer 1: Skia — fondo + isla flotante + decoración + cohete */}
      <WorldCanvas
        ref={canvasRef}
        worldId={currentWorldId}
        canTravel={canTravel}
        reduceMotion={reduceMotion.value}
      />

      {/* Layer 2: Cohete — Pressable invisible encima del sprite Skia */}
      <WorldRocket
        worldId={currentWorldId}
        canTravel={canTravel}
        hasNext={nextWorld !== null}
        nextWorldName={nextWorld?.name}
        bobOffset={canvasRef.current?.bobOffset ?? fallbackBob}
        onTap={handleRocketTap}
      />

      {/* Layer 3: HUD + dock de minijuegos */}
      <WorldOverlay
        playerName={nickname}
        avatarEmoji={avatarEmoji}
        xp={xp}
        totalCetis={totalCetis}
        streak={streak}
        isStreakActive={isStreakActive}
        coinCatchCooldownUntil={minigameCooldowns.coinCatch}
        saveOrSpendCooldownUntil={minigameCooldowns.saveOrSpend}
        onOpenCoinCatch={() => setShowCoinCatch(true)}
        onOpenSaveOrSpend={() => setShowSaveOrSpend(true)}
      />

      {/* Level up modal */}
      <LevelUpModal level={level} isVisible={showLevelUp} onClose={() => celebrateLevel(level)} />

      {/* Sheet de confirmación de viaje */}
      <WorldUnlockSheet
        visible={showUnlockSheet}
        onClose={() => setShowUnlockSheet(false)}
        nextWorld={nextWorld}
        totalCetis={totalCetis}
        onConfirm={handleConfirmTravel}
        isLoading={traveling}
      />

      {/* Animación de viaje */}
      <WorldRocketLoader visible={traveling} onArrive={handleArrive} />

      {/* Minijuegos */}
      <CoinCatchGame visible={showCoinCatch} onClose={() => setShowCoinCatch(false)} />
      <SaveOrSpendGame visible={showSaveOrSpend} onClose={() => setShowSaveOrSpend(false)} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
