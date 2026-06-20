/**
 * EligeCaminoView — presents a single EligeCamino situational choice.
 *
 * Flow:
 *  1. Student reads the enunciado and picks opcionA or opcionB.
 *  2. The chosen option's consecuencia is revealed (reflective learning).
 *  3. "Continuar" calls onFinish — no score, no persistence (R5, R10).
 *
 * R5: no correct/incorrect marking; no per-student persistence of the choice.
 * R10: no XP awarded here.
 * R7: situation selection is deterministic (caller passes the situacion).
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
import type { Situacion } from '@features/learning/data/content.types';

type Eleccion = 'A' | 'B' | null;

interface EligeCaminoViewProps {
  situacion: Situacion;
  worldName: string;
  accentColor: string;
  onFinish: () => void;
}

export default function EligeCaminoView({
  situacion,
  worldName,
  accentColor,
  onFinish,
}: EligeCaminoViewProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [eleccion, setEleccion] = useState<Eleccion>(null);

  const chosen = eleccion === 'A' ? situacion.opcionA : eleccion === 'B' ? situacion.opcionB : null;

  const handleChoose = (opt: 'A' | 'B') => {
    if (eleccion !== null) return; // Lock after first choice
    setEleccion(opt);
  };

  const buttonStyle = (opt: 'A' | 'B') => {
    const isSelected = eleccion === opt;
    const isOther = eleccion !== null && eleccion !== opt;
    return [
      optSt.btn,
      {
        backgroundColor: isSelected ? accentColor + '22' : colors.background.elevated,
        borderColor: isSelected ? accentColor : colors.materials.border,
        opacity: isOther ? 0.45 : (1 as number),
      },
    ];
  };

  const textColor = (opt: 'A' | 'B') => {
    return eleccion === opt ? accentColor : colors.text.primary;
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
          <View style={[st.badge, { backgroundColor: accentColor + '22' }]}>
            <Ionicons name="git-branch-outline" size={14} color={accentColor} />
            <Text style={[st.badgeText, { color: accentColor }]}>{t('eligeCamino.badge')}</Text>
          </View>
          <Text style={[st.worldLabel, { color: colors.text.tertiary }]}>{worldName}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[st.scroll, { paddingBottom: Math.max(insets.bottom, 16) + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Situation */}
        <Animated.View entering={FadeIn.duration(250)} style={st.situacionWrap}>
          <Text style={[st.titulo, { color: colors.text.primary }]}>{t('eligeCamino.titulo')}</Text>
          <View
            style={[
              st.situacionCard,
              {
                backgroundColor: colors.background.elevated,
                borderColor: colors.materials.border,
              },
            ]}
          >
            <Text style={[st.enunciado, { color: colors.text.primary }]}>
              {situacion.enunciado}
            </Text>
          </View>
        </Animated.View>

        {/* Options */}
        <Animated.View entering={FadeInDown.duration(280).delay(80)} style={st.opciones}>
          <Text style={[st.opcionesLabel, { color: colors.text.tertiary }]}>
            {t('eligeCamino.opcionesLabel')}
          </Text>

          <TouchableOpacity
            activeOpacity={eleccion === null ? 0.75 : 1}
            onPress={() => handleChoose('A')}
            style={buttonStyle('A')}
            accessibilityRole="button"
            accessibilityLabel={situacion.opcionA.texto}
          >
            <View style={optSt.letterBadge}>
              <Text
                style={[
                  optSt.letter,
                  { color: eleccion === 'A' ? accentColor : colors.text.tertiary },
                ]}
              >
                A
              </Text>
            </View>
            <Text style={[optSt.label, { color: textColor('A') }]}>{situacion.opcionA.texto}</Text>
            {eleccion === 'A' && <Ionicons name="checkmark-circle" size={20} color={accentColor} />}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={eleccion === null ? 0.75 : 1}
            onPress={() => handleChoose('B')}
            style={buttonStyle('B')}
            accessibilityRole="button"
            accessibilityLabel={situacion.opcionB.texto}
          >
            <View style={optSt.letterBadge}>
              <Text
                style={[
                  optSt.letter,
                  { color: eleccion === 'B' ? accentColor : colors.text.tertiary },
                ]}
              >
                B
              </Text>
            </View>
            <Text style={[optSt.label, { color: textColor('B') }]}>{situacion.opcionB.texto}</Text>
            {eleccion === 'B' && <Ionicons name="checkmark-circle" size={20} color={accentColor} />}
          </TouchableOpacity>
        </Animated.View>

        {/* Consequence reveal */}
        {chosen !== null && (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[
              st.consecuenciaBox,
              {
                backgroundColor: accentColor + '14',
                borderColor: accentColor + '55',
              },
            ]}
          >
            <View style={st.consecuenciaHeader}>
              <Ionicons name="flash-outline" size={16} color={accentColor} />
              <Text style={[st.consecuenciaLabel, { color: accentColor }]}>
                {t('eligeCamino.consecuenciaLabel')}
              </Text>
            </View>
            <Text style={[st.consecuenciaText, { color: colors.text.primary }]}>
              {chosen.consecuencia}
            </Text>
            <Text style={[st.reflexionHint, { color: colors.text.tertiary }]}>
              {t('eligeCamino.reflexionHint')}
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Footer — only visible once a choice is made */}
      {eleccion !== null && (
        <Animated.View
          entering={FadeIn.duration(220)}
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
            onPress={onFinish}
            accessibilityRole="button"
            accessibilityLabel={t('eligeCamino.continuar')}
            style={[st.btn, { backgroundColor: accentColor }]}
          >
            <Text style={[st.btnText, { color: '#fff' }]}>{t('eligeCamino.continuar')}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    ...Typography.caption1,
    fontWeight: '600',
  },
  scroll: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
  },
  situacionWrap: {
    gap: 12,
  },
  titulo: {
    ...Typography.title3,
    fontWeight: '800',
  },
  situacionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
  },
  enunciado: {
    ...Typography.body,
    lineHeight: 24,
  },
  opciones: {
    gap: 10,
  },
  opcionesLabel: {
    ...Typography.caption1,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  consecuenciaBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.base,
    gap: 10,
  },
  consecuenciaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  consecuenciaLabel: {
    ...Typography.caption1,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  consecuenciaText: {
    ...Typography.body,
    lineHeight: 24,
  },
  reflexionHint: {
    ...Typography.footnote,
    fontStyle: 'italic',
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

const optSt = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: 14,
    gap: 10,
  },
  letterBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontSize: 13,
    fontWeight: '900',
  },
  label: {
    ...Typography.body,
    flex: 1,
    lineHeight: 22,
  },
});
