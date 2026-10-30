/**
 * Fase 9 — la rúbrica en pantalla: un criterio por fila y sus cuatro niveles.
 * `elegidos` marca el nivel de cada criterio; `sugeridos` (la IA) va con borde
 * punteado y su frase de por qué. Sin `onElegir` es solo para leer.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import type { Rubrica as RubricaT, SugerenciaCriterio } from '@/functions/src/educadores/dominio';

export default function Rubrica({
  rubrica,
  elegidos,
  sugeridos,
  onElegir,
}: {
  rubrica: RubricaT;
  elegidos?: (number | null)[];
  sugeridos?: SugerenciaCriterio[] | null;
  onElegir?: (criterio: number, nivel: number) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <View style={{ gap: 12 }}>
      {rubrica.criterios.map((c, i) => {
        const sug = sugeridos?.[i];
        return (
          <View key={i} style={{ gap: 6 }}>
            <Text style={[st.criterio, { color: colors.text.primary }]}>{c.nombre}</Text>
            <View style={st.niveles}>
              {c.niveles.map((n, j) => {
                const elegido = elegidos?.[i] === j;
                const sugerido = sug?.nivel === j;
                return (
                  <Bounceable
                    key={j}
                    onPress={onElegir ? () => onElegir(i, j) : undefined}
                    disabled={!onElegir}
                    activeScale={0.95}
                    accessibilityRole={onElegir ? 'button' : undefined}
                    accessibilityState={{ selected: elegido }}
                    accessibilityLabel={`${c.nombre}: ${n.nombre}${sugerido ? ` · ${t('rubricas.iaSugiere')}` : ''}`}
                    style={[
                      st.nivel,
                      {
                        borderColor: elegido ? colors.system.green : sugerido ? colors.system.blue : colors.materials.border,
                        borderStyle: sugerido && !elegido ? 'dashed' : 'solid',
                        backgroundColor: elegido ? colors.fill.greenSubtle : colors.materials.base,
                      },
                    ]}
                  >
                    <Text style={[st.nivelNombre, { color: elegido ? colors.system.green : colors.text.primary }]}>{n.nombre}</Text>
                    <Text style={[st.puntos, { color: colors.text.tertiary }]}>{t('rubricas.puntos', { count: n.puntos })}</Text>
                    {n.descriptor ? (
                      <Text style={[st.descriptor, { color: colors.text.secondary }]} numberOfLines={4}>
                        {n.descriptor}
                      </Text>
                    ) : null}
                  </Bounceable>
                );
              })}
            </View>
            {sug?.porque ? (
              <Text style={[st.porque, { color: colors.system.blue }]}>{t('rubricas.porque', { texto: sug.porque })}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  criterio: { fontSize: 15, fontWeight: '900' },
  niveles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  nivel: { flexGrow: 1, flexBasis: 120, minWidth: 0, borderWidth: 2, borderRadius: 12, padding: 8, gap: 2 },
  nivelNombre: { fontSize: 13, fontWeight: '900' },
  puntos: { fontSize: 11, fontWeight: '800' },
  descriptor: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  porque: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
});
