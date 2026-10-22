/**
 * Año escolar o Mensual: dos opciones con relieve (como los chips del kit), el
 * Año escolar primero y con lo que se ahorra frente a 12 mensualidades.
 */
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { ahorroAnioEscolar, type Ciclo } from '@/functions/src/educadores/dominio';
import { Pill } from '@features/dashboard/components/profe/kit';

const CICLOS_EN_ORDEN: readonly Ciclo[] = ['anioEscolar', 'mensual'];

export default function PlanesSelectorCiclo({
  ciclo,
  onCambiar,
}: {
  ciclo: Ciclo;
  onCambiar: (c: Ciclo) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <View style={styles.fila} accessibilityRole="radiogroup">
      {CICLOS_EN_ORDEN.map((c) => {
        const elegido = c === ciclo;
        const anio = c === 'anioEscolar';
        const nombre = t(`educadores.planes.ciclo.${c}`);
        const nota = t(
          anio ? 'educadores.planes.ciclo.anioNota' : 'educadores.planes.ciclo.mensualNota'
        );
        return (
          <Bounceable
            key={c}
            onPress={() => {
              if (elegido) return;
              if (Platform.OS !== 'web') void Haptics.selectionAsync();
              onCambiar(c);
            }}
            activeScale={0.96}
            accessibilityRole="radio"
            accessibilityState={{ checked: elegido }}
            accessibilityLabel={`${nombre}. ${nota}`}
            style={[
              styles.opcion,
              {
                backgroundColor: elegido ? colors.fill.brandSubtle : colors.materials.base,
                borderColor: elegido ? colors.brand.primary : colors.materials.border,
              },
            ]}
          >
            <View style={styles.cabeza}>
              <Text
                style={[
                  styles.nombre,
                  { color: elegido ? colors.text.primary : colors.text.secondary },
                ]}
                numberOfLines={1}
              >
                {nombre}
              </Text>
              <Ionicons
                name={elegido ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={elegido ? colors.brand.primary : colors.text.quaternary}
              />
            </View>
            <Text style={[styles.nota, { color: colors.text.tertiary }]} numberOfLines={2}>
              {nota}
            </Text>
            {anio ? (
              <Pill
                texto={t('educadores.planes.ciclo.ahorras', { pct: ahorroAnioEscolar('piloto') })}
                tono="verde"
                style={{ marginTop: 2 }}
              />
            ) : null}
          </Bounceable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', gap: 10 },
  opcion: {
    flex: 1,
    minWidth: 0,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  cabeza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  nombre: { fontSize: 16, fontWeight: '900', flexShrink: 1 },
  nota: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
});
