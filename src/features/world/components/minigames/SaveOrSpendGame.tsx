// SaveOrSpendGame.tsx — Minijuego dilemas financieros: ¿Ahorro o Gasto?
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import { Spacing } from '@shared/constants/theme';
import CetiButton from '@shared/components/CetiButton';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import { useChildStore } from '@features/auth/store/useChildStore';
import { useWorldStore } from '../../store/useWorldStore';
import {
  drawCards,
  SAVE_OR_SPEND_COOLDOWN_MS,
  type SaveOrSpendCard,
  type SmartChoice,
} from '../../data/saveOrSpendCards';
import { logEvent } from '@shared/lib/analytics/logEvent';

const { width: SW } = Dimensions.get('window');

const CETIS_PER_CORRECT = 3;
const XP_PER_CORRECT = 5;
const BONUS_XP_ALL_CORRECT = 20;

const piggyAnimation = require('../../../../../assets/lottie/Piggy Bank - Dancing.json');

type Phase = 'idle' | 'playing' | 'feedback' | 'result';

interface SaveOrSpendGameProps {
  visible: boolean;
  onClose: () => void;
}

// ── Indicador de progreso de cartas ──────────────────────────────────────────
function ProgressDots({ total, current }: { total: number; current: number }) {
  const colors = useThemeColors();
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor:
                i < current
                  ? colors.system.green
                  : i === current
                    ? colors.brand.primary
                    : colors.materials.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ── Card animada ──────────────────────────────────────────────────────────────
interface CardProps {
  card: SaveOrSpendCard;
  onChoose: (choice: SmartChoice) => void;
  disabled: boolean;
}

function CardView({ card, onChoose, disabled }: CardProps) {
  const colors = useThemeColors();
  const translateX = useSharedValue(SW);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = SW;
    opacity.value = 0;
    translateX.value = withSpring(0, { damping: 18, stiffness: 140 });
    opacity.value = withTiming(1, { duration: 250 });
  }, [card.id]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.cardWrap, cardStyle]}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.background.secondary, borderColor: colors.materials.border },
        ]}
      >
        {/* Ilustración */}
        <View style={[styles.cardIconWrap, { backgroundColor: colors.background.tertiary }]}>
          <Ionicons name={card.icon} size={48} color={card.iconColor} />
        </View>
        {/* Texto */}
        <Text style={[styles.cardTitle, { color: colors.text.primary }]}>{card.title}</Text>
        <Text style={[styles.cardContext, { color: colors.text.secondary }]}>{card.context}</Text>
      </View>

      {/* Botones de elección */}
      <View style={styles.choiceRow}>
        <Pressable
          onPress={() => !disabled && onChoose('save')}
          accessibilityRole="button"
          accessibilityLabel="Ahorrar"
          style={({ pressed }) => [
            styles.choiceBtn,
            {
              backgroundColor: colors.system.blue,
              borderColor: colors.system.blue,
            },
            pressed && !disabled && styles.choiceBtnPressed,
            disabled && styles.choiceBtnDisabled,
          ]}
        >
          <Ionicons name="save-outline" size={22} color={colors.text.inverse} />
          <Text style={[styles.choiceBtnText, { color: colors.text.inverse }]}>Ahorrar</Text>
        </Pressable>
        <Pressable
          onPress={() => !disabled && onChoose('spend')}
          accessibilityRole="button"
          accessibilityLabel="Gastar"
          style={({ pressed }) => [
            styles.choiceBtn,
            {
              backgroundColor: colors.system.orange,
              borderColor: colors.system.orange,
            },
            pressed && !disabled && styles.choiceBtnPressed,
            disabled && styles.choiceBtnDisabled,
          ]}
        >
          <Ionicons name="cart-outline" size={22} color={colors.text.inverse} />
          <Text style={[styles.choiceBtnText, { color: colors.text.inverse }]}>Gastar</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ── Feedback de elección ──────────────────────────────────────────────────────
interface FeedbackProps {
  correct: boolean;
  explanation: string;
  onNext: () => void;
  showPiggy: boolean;
}

function FeedbackView({ correct, explanation, onNext, showPiggy }: FeedbackProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.feedbackWrap}>
      {correct && showPiggy ? (
        <LottieView
          source={piggyAnimation}
          autoPlay
          loop={false}
          style={styles.piggyLottie}
          speed={1.3}
        />
      ) : (
        <View
          style={[
            styles.feedbackIcon,
            { backgroundColor: correct ? colors.fill.greenSubtle : colors.fill.redSubtle },
          ]}
        >
          <Ionicons
            name={correct ? 'checkmark-circle' : 'close-circle'}
            size={52}
            color={correct ? colors.system.green : colors.system.red}
          />
        </View>
      )}
      <Text
        style={[styles.feedbackTitle, { color: correct ? colors.system.green : colors.system.red }]}
      >
        {correct ? '¡Decisión inteligente!' : 'Otra opción era mejor'}
      </Text>
      <Text style={[styles.feedbackExplanation, { color: colors.text.secondary }]}>
        {explanation}
      </Text>
      {correct && (
        <View style={[styles.rewardChip, { backgroundColor: colors.background.elevated }]}>
          <Ionicons name="sparkles" size={14} color={colors.gold.primary} />
          <Text style={[styles.rewardChipText, { color: colors.gold.primary }]}>
            +{CETIS_PER_CORRECT} Cetis · +{XP_PER_CORRECT} XP
          </Text>
        </View>
      )}
      <CetiButton
        label="Siguiente"
        onPress={onNext}
        variant="primary"
        size="large"
        style={styles.nextBtn}
        backgroundColor={colors.brand.primary}
      />
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SaveOrSpendGame({ visible, onClose }: SaveOrSpendGameProps) {
  const colors = useThemeColors();
  const earnCetis = useWalletStore((s) => s.earnCetis);
  const addXP = useChildStore((s) => s.addXP);
  const setMinigameCooldown = useWorldStore((s) => s.setMinigameCooldown);

  const [phase, setPhase] = useState<Phase>('idle');
  const [cards, setCards] = useState<SaveOrSpendCard[]>([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [lastExplanation, setLastExplanation] = useState('');
  const [choiceDisabled, setChoiceDisabled] = useState(false);

  const startGame = useCallback(() => {
    const drawn = drawCards(5);
    setCards(drawn);
    setCardIdx(0);
    setCorrectCount(0);
    setPhase('playing');
  }, []);

  const handleChoose = useCallback(
    (choice: SmartChoice) => {
      if (choiceDisabled) return;
      const card = cards[cardIdx];
      if (!card) return;
      setChoiceDisabled(true);
      const correct = choice === card.smartChoice;
      setLastCorrect(correct);
      setLastExplanation(card.explanation);
      if (correct) {
        earnCetis(CETIS_PER_CORRECT, 'Save or Spend', 'lesson');
        addXP?.(XP_PER_CORRECT);
        setCorrectCount((c) => c + 1);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      setPhase('feedback');
    },
    [cards, cardIdx, choiceDisabled, earnCetis, addXP]
  );

  const handleNext = useCallback(() => {
    const nextIdx = cardIdx + 1;
    if (nextIdx >= cards.length) {
      // Fin del juego
      if (correctCount + (lastCorrect ? 1 : 0) === cards.length) {
        addXP?.(BONUS_XP_ALL_CORRECT);
      }
      setMinigameCooldown('saveOrSpend', Date.now() + SAVE_OR_SPEND_COOLDOWN_MS);
      void logEvent('minigame_complete', {
        game: 'save_or_spend',
        correct: correctCount + (lastCorrect ? 1 : 0),
        total: cards.length,
      });
      setPhase('result');
    } else {
      setCardIdx(nextIdx);
      setChoiceDisabled(false);
      setPhase('playing');
    }
  }, [cardIdx, cards.length, correctCount, lastCorrect, addXP, setMinigameCooldown]);

  const handleClose = useCallback(() => {
    setPhase('idle');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!visible) setPhase('idle');
  }, [visible]);

  const finalCorrect = correctCount + (lastCorrect && phase === 'result' ? 1 : 0);
  const isPerfect = finalCorrect === 5;
  const card = cards[cardIdx];

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <SafeAreaView
        style={[styles.root, { backgroundColor: colors.background.base }]}
        edges={['top', 'right', 'bottom', 'left']}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="git-compare-outline" size={20} color={colors.brand.primary} />
            <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Save or Spend</Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={12} accessibilityLabel="Cerrar juego">
            <Ionicons name="close" size={26} color={colors.text.secondary} />
          </Pressable>
        </View>

        {/* Progreso */}
        {(phase === 'playing' || phase === 'feedback') && (
          <ProgressDots total={cards.length} current={cardIdx} />
        )}

        {/* IDLE */}
        {phase === 'idle' && (
          <View style={styles.centeredBlock}>
            <Ionicons name="git-compare-outline" size={64} color={colors.brand.primary} />
            <Text style={[styles.bigTitle, { color: colors.text.primary }]}>Save or Spend</Text>
            <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
              5 dilemas financieros reales.{'\n'}
              Elige la decisión más inteligente{'\n'}y gana Cetis y XP.
            </Text>
            <View style={[styles.rewardInfoBox, { backgroundColor: colors.background.elevated }]}>
              <Text style={[styles.rewardInfoText, { color: colors.text.secondary }]}>
                Por cada respuesta correcta:
              </Text>
              <View style={styles.rewardInfoRow}>
                <Ionicons name="sparkles" size={14} color={colors.gold.primary} />
                <Text style={[styles.rewardInfoValue, { color: colors.gold.primary }]}>
                  +{CETIS_PER_CORRECT} Cetis
                </Text>
                <Ionicons name="flash" size={14} color={colors.brand.primary} />
                <Text style={[styles.rewardInfoValue, { color: colors.brand.primary }]}>
                  +{XP_PER_CORRECT} XP
                </Text>
              </View>
              <Text style={[styles.rewardInfoText, { color: colors.text.tertiary }]}>
                ¡5/5 correcto: +{BONUS_XP_ALL_CORRECT} XP extra!
              </Text>
            </View>
            <CetiButton
              label="Empezar"
              onPress={startGame}
              variant="primary"
              size="large"
              style={styles.ctaBtn}
              backgroundColor={colors.brand.primary}
            />
          </View>
        )}

        {/* PLAYING */}
        {phase === 'playing' && card && (
          <CardView card={card} onChoose={handleChoose} disabled={choiceDisabled} />
        )}

        {/* FEEDBACK */}
        {phase === 'feedback' && (
          <FeedbackView
            correct={lastCorrect}
            explanation={lastExplanation}
            onNext={handleNext}
            showPiggy={lastCorrect}
          />
        )}

        {/* RESULT */}
        {phase === 'result' && (
          <View style={styles.centeredBlock}>
            <Ionicons
              name={isPerfect ? 'trophy' : finalCorrect >= 3 ? 'star' : 'star-outline'}
              size={64}
              color={
                isPerfect
                  ? colors.gold.primary
                  : finalCorrect >= 3
                    ? colors.brand.primary
                    : colors.text.tertiary
              }
            />
            <Text style={[styles.bigTitle, { color: colors.text.primary }]}>
              {finalCorrect}/{cards.length} correctas
            </Text>
            {isPerfect && (
              <Text style={[styles.perfectLabel, { color: colors.gold.primary }]}>
                ¡Puntaje perfecto!
              </Text>
            )}
            <View style={[styles.cetisEarned, { backgroundColor: colors.background.elevated }]}>
              <Ionicons name="sparkles" size={18} color={colors.gold.primary} />
              <Text style={[styles.cetisEarnedText, { color: colors.gold.primary }]}>
                +{finalCorrect * CETIS_PER_CORRECT} Cetis · +{finalCorrect * XP_PER_CORRECT}
                {isPerfect ? ` + ${BONUS_XP_ALL_CORRECT}` : ''} XP
              </Text>
            </View>
            <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>
              Puedes jugar de nuevo en 4 horas
            </Text>
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
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  centeredBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.md,
  },
  bigTitle: {
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  perfectLabel: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  rewardInfoBox: {
    width: '100%',
    borderRadius: 14,
    padding: Spacing.md,
    gap: 8,
    alignItems: 'center',
  },
  rewardInfoText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  rewardInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rewardInfoValue: { fontSize: 15, fontWeight: '800' },
  ctaBtn: { width: '100%', marginTop: Spacing.sm },
  cardWrap: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    gap: Spacing.base,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  cardIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    ...Typography.title2,
    fontWeight: '900',
    textAlign: 'center',
  },
  cardContext: {
    ...Typography.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  choiceBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  choiceBtnPressed: {
    transform: [{ scale: 0.98 }],
  },
  choiceBtnDisabled: {
    opacity: 0.5,
  },
  choiceBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
  feedbackWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.md,
  },
  feedbackIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackTitle: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  feedbackExplanation: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  rewardChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  nextBtn: { width: '100%', marginTop: Spacing.sm },
  piggyLottie: { width: 130, height: 130 },
  cetisEarned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  cetisEarnedText: {
    fontSize: 16,
    fontWeight: '900',
  },
});
