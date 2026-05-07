import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import LottieView from 'lottie-react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { motion, lottieSpeed } from '@shared/constants/motion';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import CetiButton from '@shared/components/CetiButton';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import { Spacing } from '@shared/constants/theme';
import {
  useStreakCelebrationStore,
  type StreakCelebrationPayload,
} from '@features/auth/store/useStreakCelebrationStore';
import { useChildStore } from '@features/auth/store/useChildStore';
import {
  WEEKDAY_LABELS_SUN_START_ES,
  getCurrentWeekDaysSunStart,
} from '@shared/utils/calendarDate';

const fireAnimation = require('../../../assets/lottie/Fire.json');

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const LOTTIE_START_FRAME = 0;
const LOTTIE_END_FRAME = 101;
/** Último frame normalizado (0–1) para la miniatura en fase `content` (misma composición, `op` 120). */
const LOTTIE_END_PROGRESS = LOTTIE_END_FRAME / 120;

function formatStreakDigits(n: number): string {
  if (n < 100) return String(n).padStart(2, '0');
  return String(n);
}

function messageFor(payload: StreakCelebrationPayload): string {
  if (payload.kind === 'first') {
    return 'Activaste tu racha. ¡Buen arranque!';
  }
  return `+1 día — ${payload.newStreak} seguidos. ¡Sigue así!`;
}

type StreakPhase = 'fire' | 'content';

export default function StreakCelebrationModal() {
  const pending = useStreakCelebrationStore((s) => s.pending);
  const clear = useStreakCelebrationStore((s) => s.clear);
  const missionCalendarDays = useChildStore((s) => s.missionCalendarDays);
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const lottieRef = useRef<LottieView>(null);
  const [phase, setPhase] = useState<StreakPhase>('fire');

  const visible = pending != null;
  const msg = useMemo(() => (pending ? messageFor(pending) : ''), [pending]);
  const streakDigits = pending ? formatStreakDigits(pending.newStreak) : '';

  const weekDays = useMemo(() => getCurrentWeekDaysSunStart(), []);
  const missionSet = useMemo(() => new Set(missionCalendarDays), [missionCalendarDays]);

  const onContinue = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clear();
  }, [clear]);

  const lottieKey = pending ? `${pending.kind}-${pending.newStreak}` : 'idle';
  const accent = colors.brand.primary;

  const handleAnimationLoaded = useCallback(() => {
    lottieRef.current?.play(LOTTIE_START_FRAME, LOTTIE_END_FRAME);
  }, []);

  const handleLottieFinish = useCallback((isCancelled: boolean) => {
    if (!isCancelled) {
      setPhase('content');
    }
  }, []);

  useEffect(() => {
    if (!pending) return;
    setPhase('fire');
  }, [pending]);

  useEffect(() => {
    if (!pending || !isExpoGo) return;
    const t = setTimeout(() => setPhase('content'), 1500);
    return () => clearTimeout(t);
  }, [pending, isExpoGo, lottieKey]);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View
        style={[
          styles.scrim,
          { backgroundColor: colors.background.base, paddingTop: insets.top + Spacing.md },
        ]}
      >
        <View style={styles.body}>
          {phase === 'fire' && (
            <Animated.View
              key="streak-fire"
              exiting={FadeOut.duration(140)}
              style={styles.fireStage}
            >
              {isExpoGo ? (
                <View style={styles.lottieSlot}>
                  <Text style={[styles.fallbackEmoji, { color: colors.system.orange }]}>🔥</Text>
                </View>
              ) : (
                <LottieView
                  ref={lottieRef}
                  key={lottieKey}
                  source={fireAnimation}
                  speed={lottieSpeed.default}
                  loop={false}
                  autoPlay={false}
                  onAnimationLoaded={handleAnimationLoaded}
                  onAnimationFinish={handleLottieFinish}
                  style={styles.lottieHero}
                />
              )}
            </Animated.View>
          )}

          {phase === 'content' && (
            <Animated.View
              key="streak-content"
              entering={motion.enterDown(40)}
              style={styles.contentBlock}
            >
              <Animated.View entering={motion.enterDown(56)} style={styles.fireHeaderWrap}>
                {isExpoGo ? (
                  <Text style={[styles.fallbackEmojiSmall, { color: colors.system.orange }]}>
                    🔥
                  </Text>
                ) : (
                  <LottieView
                    key={`fire-header-${lottieKey}`}
                    source={fireAnimation}
                    speed={lottieSpeed.default}
                    progress={LOTTIE_END_PROGRESS}
                    style={styles.lottieHeader}
                  />
                )}
              </Animated.View>

              <Animated.View entering={motion.enterDown(72)}>
                <Text style={[styles.streakNumber, { color: accent }]}>{streakDigits}</Text>
                <Text style={[styles.streakCaption, { color: accent }]}>días de racha</Text>
              </Animated.View>

              <View style={styles.weekRow}>
                {weekDays.map((cell, index) => {
                  const label = WEEKDAY_LABELS_SUN_START_ES[cell.dowSun0];
                  const done = missionSet.has(cell.ymd);
                  return (
                    <Animated.View
                      key={cell.ymd}
                      entering={motion.enterDownStagger(72, index)}
                      style={styles.weekCell}
                    >
                      <Text
                        style={[
                          styles.weekLabel,
                          { color: colors.text.tertiary },
                          cell.isToday && { color: accent, fontWeight: '900' },
                        ]}
                      >
                        {label}
                      </Text>
                      <View
                        style={[
                          styles.dayDot,
                          {
                            borderColor: done ? accent : colors.materials.border,
                            backgroundColor: done ? accent : colors.materials.highlight,
                          },
                        ]}
                      >
                        {done ? (
                          <Ionicons name="checkmark" size={16} color={colors.text.onBrand} />
                        ) : null}
                      </View>
                    </Animated.View>
                  );
                })}
              </View>

              <Animated.View entering={motion.enterDown(140)}>
                <Text style={[styles.message, { color: colors.text.secondary }]}>{msg}</Text>
              </Animated.View>
            </Animated.View>
          )}
        </View>

        {phase === 'content' && (
          <Animated.View
            entering={motion.enterDown(168)}
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.sm },
            ]}
          >
            <CetiButton label="Continuar" onPress={onContinue} variant="primary" size="large" />
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  fireStage: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentBlock: {
    width: '100%',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  fireHeaderWrap: {
    marginBottom: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottieHeader: {
    width: 120,
    height: 141,
  },
  fallbackEmojiSmall: {
    fontSize: 48,
    lineHeight: 56,
  },
  lottieHero: {
    width: 260,
    height: 305,
  },
  lottieSlot: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackEmoji: {
    fontSize: 72,
  },
  streakNumber: {
    fontWeight: '700',
    fontSize: 88,
    lineHeight: 92,
    letterSpacing: -4,
    marginTop: 0,
    textAlign: 'center',
  },
  streakCaption: {
    ...Typography.subheadline,
    fontWeight: '800',
    marginTop: 2,
    marginBottom: Spacing.lg,
    textTransform: 'lowercase',
    textAlign: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  weekLabel: {
    ...Typography.caption1,
    fontWeight: '700',
  },
  dayDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    ...Typography.body,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: Spacing['2xl'],
  },
});
