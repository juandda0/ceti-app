import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import CetiButton from '@shared/components/CetiButton';
import { Typography } from '@shared/constants/typography';
import { BorderRadius, Spacing } from '@shared/constants/theme';
import { LESSONS, type Lesson } from '@features/learning/data/lessons';
import { useThemeColors } from '@shared/hooks/useThemeColors';

interface LessonStartConfirmSheetProps {
  visible: boolean;
  lesson: Lesson | null;
  lessonIndex: number;
  isReplay: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function truncateDesc(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trim()}…`;
}

export default function LessonStartConfirmSheet({
  visible,
  lesson,
  lessonIndex,
  isReplay,
  onClose,
  onConfirm,
}: LessonStartConfirmSheetProps) {
  const colors = useThemeColors();

  if (!lesson) return null;

  const stepLabel = `${lessonIndex + 1} de ${LESSONS.length}`;
  const desc = truncateDesc(lesson.description, 118);

  const handleConfirm = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm();
  };

  return (
    <CetiBottomSheet visible={visible} onClose={onClose} contentOnly closeOnBackdropPress>
      <View style={styles.sheetInner}>
        <View style={[styles.handle, { backgroundColor: colors.materials.border }]} />

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.materials.highlight,
              borderColor: colors.materials.border,
            },
          ]}
        >
          <View style={styles.cardTopRow}>
            <View style={styles.cardTopText}>
              <Text style={[styles.kicker, { color: colors.brand.primary }]}>
                Misión en tu mapa
              </Text>
              <View style={styles.badgesRow}>
                <View style={[styles.stepBadge, { backgroundColor: colors.background.elevated }]}>
                  <Text style={[styles.stepBadgeText, { color: colors.text.secondary }]}>
                    Paso {stepLabel}
                  </Text>
                </View>
                {isReplay ? (
                  <View style={[styles.replayBadge, { borderColor: colors.gold.primary }]}>
                    <Ionicons name="refresh" size={12} color={colors.gold.primary} />
                    <Text style={[styles.replayBadgeText, { color: colors.gold.warm }]}>
                      Repaso
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text.primary }]}>{lesson.title}</Text>
          <Text style={[styles.description, { color: colors.text.secondary }]}>{desc}</Text>

          <View
            style={[
              styles.rewardsBand,
              { backgroundColor: colors.background.elevated, borderColor: colors.materials.border },
            ]}
          >
            <View style={styles.rewardItem}>
              <View style={[styles.rewardIcon, { backgroundColor: colors.fill.brandSubtle }]}>
                <Ionicons name="trending-up" size={16} color={colors.brand.primary} />
              </View>
              <View>
                <Text style={[styles.rewardValue, { color: colors.text.primary }]}>
                  +{lesson.xpReward}
                </Text>
                <Text style={[styles.rewardLabel, { color: colors.text.tertiary }]}>
                  XP al aprobar
                </Text>
              </View>
            </View>
            <View style={[styles.rewardDivider, { backgroundColor: colors.materials.border }]} />
            <View style={styles.rewardItem}>
              <View style={[styles.rewardIcon, { backgroundColor: colors.fill.goldSubtle }]}>
                <Ionicons name="sparkles" size={16} color={colors.gold.primary} />
              </View>
              <View>
                <Text style={[styles.rewardValue, { color: colors.text.primary }]}>
                  +{lesson.cetisReward}
                </Text>
                <Text style={[styles.rewardLabel, { color: colors.text.tertiary }]}>
                  Cetis bonus
                </Text>
              </View>
            </View>
          </View>

          <CetiButton
            label={isReplay ? 'Volver a la misión' : 'Abrir misión'}
            onPress={handleConfirm}
            variant="primary"
            size="large"
            style={styles.primaryBtn}
          />

          <Pressable
            onPress={onClose}
            style={styles.textLinkHit}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Text style={[styles.textLink, { color: colors.text.tertiary }]}>
              Seguir explorando el mapa
            </Text>
          </Pressable>
        </View>
      </View>
    </CetiBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetInner: {
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.xs,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: Spacing.md,
    opacity: 0.85,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  cardTopText: {
    flex: 1,
    gap: Spacing.sm,
  },
  kicker: {
    ...Typography.caption2,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  stepBadge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  stepBadgeText: {
    ...Typography.caption2,
    fontWeight: '800',
  },
  replayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  replayBadgeText: {
    ...Typography.caption2,
    fontWeight: '800',
  },
  title: {
    ...Typography.title2,
    fontWeight: '900',
    lineHeight: 28,
  },
  description: {
    ...Typography.subheadline,
    lineHeight: 22,
  },
  rewardsBand: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  rewardItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rewardIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardValue: {
    ...Typography.headline,
    fontWeight: '900',
  },
  rewardLabel: {
    ...Typography.caption2,
    fontWeight: '600',
  },
  rewardDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    minHeight: 36,
  },
  primaryBtn: {
    width: '100%',
    marginTop: Spacing.xs,
  },
  textLinkHit: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  textLink: {
    ...Typography.subheadline,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
