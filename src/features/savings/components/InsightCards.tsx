/**
 * Tarjetas de insights por reglas (RQ-ES11-CA3). Se recomputan en cada render y
 * NO se persisten ni llegan a analytics (R5). Sin ML: el copy visible se arma
 * con claves i18n; la categoría se traduce antes de interpolar.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { computeInsights, type InsightCtx } from '@features/savings/data/insights';

export default function InsightCards(ctx: InsightCtx) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const insights = computeInsights(ctx, 2);
  if (insights.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {insights.map((ins) => {
        const rawCat = ins.params?.categoria;
        const params = ins.params
          ? {
              ...ins.params,
              ...(rawCat ? { categoria: t(`movimientos.categorias.${rawCat}`) } : {}),
            }
          : undefined;
        return (
          <View
            key={ins.id}
            style={[
              styles.card,
              { backgroundColor: colors.materials.highlight, borderColor: colors.materials.border },
            ]}
          >
            <Ionicons name="bulb-outline" size={18} color={colors.brand.primary} />
            <Text style={[styles.text, { color: colors.text.primary }]}>
              {t(ins.i18nKey, params)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  text: { ...Typography.subheadline, flex: 1 },
});
