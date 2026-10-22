/**
 * MicroteoriaView — presents micro-theory cards before the quiz.
 *
 * Shows cards one at a time (carousel). On the last card the "Continuar" button
 * calls onFinish, handing control back to the flow orchestrator.
 *
 * R7: purely presentational; no adaptive logic.
 * R11: no PDF certificate generation.
 */
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import { Spacing, BorderRadius } from '@shared/constants/theme';
import type { MicroteoriaCard } from '@features/learning/data/content.types';

interface MicroteoriaViewProps {
  cards: MicroteoriaCard[];
  worldName: string;
  accentColor: string;
  onFinish: () => void;
  /** Modo guía (leída desde Tu Galaxia): botón de volver arriba y el botón final no lleva al quiz. */
  onBack?: () => void;
  finishLabel?: string;
}

export default function MicroteoriaView({
  cards,
  worldName,
  accentColor,
  onFinish,
  onBack,
  finishLabel,
}: MicroteoriaViewProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);

  const current = cards[index];
  const isLast = index === cards.length - 1;

  if (!current) return null;

  const handleNext = () => {
    if (isLast) {
      onFinish();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <View style={[st.container, { backgroundColor: colors.background.base }]}>
      {/* Header */}
      <View
        style={[
          st.header,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 8) + 8,
            backgroundColor: colors.background.elevated,
            borderBottomColor: colors.materials.border,
          },
        ]}
      >
        <View style={st.headerRow}>
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={t('microteoria.volver')}
              hitSlop={8}
              style={[st.backBtn, { backgroundColor: colors.background.base }]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
            </TouchableOpacity>
          ) : null}
          <View style={[st.badge, { backgroundColor: accentColor + '22' }]}>
            <Ionicons name="book-outline" size={14} color={accentColor} />
            <Text style={[st.badgeText, { color: accentColor }]}>{t('microteoria.badge')}</Text>
          </View>
          <Text style={[st.worldLabel, { color: colors.text.tertiary }]}>{worldName}</Text>
        </View>
        {/* Progress dots */}
        {cards.length > 1 && (
          <View style={st.dots}>
            {cards.map((_, i) => (
              <View
                key={i}
                style={[
                  st.dot,
                  {
                    backgroundColor: i === index ? accentColor : colors.materials.highlight,
                    width: i === index ? 20 : 6,
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {/* Card content */}
      <ScrollView
        key={index}
        contentContainerStyle={[st.scroll, { paddingBottom: Math.max(insets.bottom, 16) + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(250)} style={st.cardWrap}>
          <View
            style={[
              st.card,
              {
                backgroundColor: colors.background.elevated,
                borderColor: colors.materials.border,
              },
            ]}
          >
            <Text style={[st.cardTitle, { color: accentColor }]}>{current.titulo}</Text>
            <Animated.View entering={FadeInDown.duration(280).delay(60)}>
              <Text style={[st.cardBody, { color: colors.text.primary }]}>{current.cuerpo}</Text>
            </Animated.View>
            {current.ejemplo != null && current.ejemplo !== '' && (
              <Animated.View
                entering={FadeInDown.duration(280).delay(120)}
                style={[
                  st.exampleBox,
                  { backgroundColor: accentColor + '18', borderColor: accentColor + '44' },
                ]}
              >
                <View style={st.exampleHeader}>
                  <Ionicons name="bulb-outline" size={14} color={accentColor} />
                  <Text style={[st.exampleLabel, { color: accentColor }]}>
                    {t('microteoria.ejemplo')}
                  </Text>
                </View>
                <Text style={[st.exampleText, { color: colors.text.secondary }]}>
                  {current.ejemplo}
                </Text>
              </Animated.View>
            )}
          </View>

          <Text style={[st.counter, { color: colors.text.quaternary }]}>
            {t('microteoria.counter', { current: index + 1, total: cards.length })}
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Footer */}
      <View
        style={[
          st.footer,
          {
            backgroundColor: colors.background.base,
            borderTopColor: colors.materials.border,
            paddingBottom: Math.max(insets.bottom, 16) + 4,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleNext}
          accessibilityRole="button"
          accessibilityLabel={isLast ? (finishLabel ?? t('microteoria.continuar')) : t('microteoria.siguiente')}
          style={[st.btn, { backgroundColor: accentColor }]}
        >
          <Text style={[st.btnText, { color: '#fff' }]}>
            {isLast ? (finishLabel ?? t('microteoria.continuar')) : t('microteoria.siguiente')}
          </Text>
          {isLast && finishLabel ? null : <Ionicons name="arrow-forward" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  worldLabel: {
    marginLeft: 'auto',
    ...Typography.caption1,
    fontWeight: '600',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  scroll: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    gap: Spacing.base,
  },
  cardWrap: {
    gap: 16,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: 16,
  },
  cardTitle: {
    ...Typography.title3,
    fontWeight: '800',
    lineHeight: 26,
  },
  cardBody: {
    ...Typography.body,
    lineHeight: 24,
  },
  exampleBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.base,
    gap: 8,
  },
  exampleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  exampleLabel: {
    ...Typography.caption1,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exampleText: {
    ...Typography.footnote,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  counter: {
    ...Typography.caption1,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.base,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  btn: {
    height: 54,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: {
    ...Typography.headline,
    fontWeight: '800',
  },
});
