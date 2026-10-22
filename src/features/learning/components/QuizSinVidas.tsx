/**
 * Sin vidas: el estudiante falló tres veces en el mismo intento y debe empezar el
 * mundo desde cero. Ceti triste se reproduce una sola vez y queda en su pose final.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { CetiAnimation } from '@features/animations';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import { Spacing, BorderRadius } from '@shared/constants/theme';
import { enterFadeUp, enterSoftFade } from '@shared/constants/motion';

export default function QuizSinVidas({
  worldName,
  accentColor,
  insetTop,
  insetBottom,
  onRetry,
  onBack,
}: {
  worldName: string;
  accentColor: string;
  insetTop: number;
  insetBottom: number;
  onRetry: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <ScreenWrapper style={{ flex: 1, backgroundColor: colors.background.base }}>
      <View
        style={[
          st.wrap,
          {
            paddingTop: Math.max(insetTop, 20) + 24,
            paddingBottom: Math.max(insetBottom, 24) + 24,
          },
        ]}
      >
        <Animated.View entering={enterSoftFade()} style={st.center}>
          <CetiAnimation id="mascot.ceti-triste" size={260} />
          <Text style={[st.title, { color: colors.text.primary }]}>{t('quiz.livesNone')}</Text>
          <Text style={[st.subtitle, { color: colors.text.secondary }]}>
            {t('quiz.gameOverHint', { world: worldName })}
          </Text>
        </Animated.View>

        <Animated.View entering={enterFadeUp(3, 40)} style={st.actions}>
          <TouchableOpacity
            onPress={onRetry}
            activeOpacity={0.85}
            style={[st.btn, { backgroundColor: accentColor }]}
            accessibilityRole="button"
            accessibilityLabel={t('quiz.restartWorld')}
          >
            <Text style={[st.btnText, { color: '#fff' }]}>{t('quiz.restartWorld')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.7}
            style={st.btn}
            accessibilityRole="button"
            accessibilityLabel={t('quiz.backToWorlds')}
          >
            <Text style={[st.btnText, { color: colors.text.secondary }]}>
              {t('quiz.backToWorlds')}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    justifyContent: 'space-between',
  },
  center: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    ...Typography.title1,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.headline,
    textAlign: 'center',
  },
  actions: {
    gap: 6,
  },
  btn: {
    height: 54,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    ...Typography.headline,
    fontWeight: '800',
  },
});
