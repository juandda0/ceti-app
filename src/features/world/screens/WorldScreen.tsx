// app/(child)/world.tsx — Pantalla principal del mundo 3D (Versión Asteroide)
import { StyleSheet } from 'react-native';
import { Colors } from '@shared/constants/colors';
import { useChildStore } from '@features/auth/store/useChildStore';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import { useRewards } from '@shared/hooks/useRewards';
import { useEffect } from 'react';
import WorldScene from '@features/world/components/WorldScene';
import WorldOverlay from '@features/world/components/WorldOverlay';
import LevelUpModal from '@features/world/components/LevelUpModal';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import TutorialGuide from '@features/onboarding/components/TutorialGuide';

const AVATAR_MAP: Record<string, string> = {
  avatar_1: '🦁', avatar_2: '🐸', avatar_3: '🦊', avatar_4: '🐼',
  avatar_5: '🐱', avatar_6: '🐶', avatar_7: '🦄', avatar_8: '🐨',
};

export default function WorldScreen() {
  const { nickname, xp, avatarId, streak, level, lastCelebratedLevel, celebrateLevel, hasCompletedTutorial, isOnboarded } = useChildStore();
  const totalCetis = useWalletStore((s) => s.totalCetis);
  const colors = useThemeColors();
  const { checkAll } = useRewards();

  useEffect(() => {
    if (isOnboarded) {
      checkAll();
    }
  }, [level, streak, totalCetis, isOnboarded]);

  if (!isOnboarded) {
    return null; // O una pantalla de carga
  }

  const showLevelUp = level > lastCelebratedLevel;
  const avatarEmoji = AVATAR_MAP[avatarId] ?? '';

  return (
    <ScreenWrapper style={[styles.container, { backgroundColor: colors.background.base }]}>
      <WorldScene />

      <WorldOverlay
        playerName={nickname}
        avatarEmoji={avatarEmoji}
        xp={xp}
        totalCetis={totalCetis}
        streak={streak}
      />

      <LevelUpModal
        level={level}
        isVisible={showLevelUp}
        onClose={() => celebrateLevel(level)}
      />

      {!hasCompletedTutorial && <TutorialGuide />}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
