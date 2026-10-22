/**
 * Medio de pago: Nequi, Tarjeta o PSE/Bancolombia/otro. Filas con relieve (como
 * los chips del kit) con su subtítulo: cobro automático o pago único.
 */
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';

export type MedioPago = 'nequi' | 'tarjeta' | 'otro';

const MEDIOS: readonly { id: MedioPago; icono: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'nequi', icono: 'phone-portrait' },
  { id: 'tarjeta', icono: 'card' },
  { id: 'otro', icono: 'business' },
];

export default function PagoSelectorMedio({
  medio,
  onCambiar,
}: {
  medio: MedioPago;
  onCambiar: (m: MedioPago) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <View style={styles.lista} accessibilityRole="radiogroup">
      {MEDIOS.map(({ id, icono }) => {
        const elegido = id === medio;
        const titulo = t(`educadores.pago.medio.${id}`);
        const sub = t(`educadores.pago.medio.${id}Sub`);
        return (
          <Bounceable
            key={id}
            onPress={() => {
              if (elegido) return;
              if (Platform.OS !== 'web') void Haptics.selectionAsync();
              onCambiar(id);
            }}
            activeScale={0.97}
            accessibilityRole="radio"
            accessibilityState={{ checked: elegido }}
            accessibilityLabel={`${titulo}. ${sub}`}
            style={[
              styles.fila,
              {
                backgroundColor: elegido ? colors.fill.brandSubtle : colors.materials.base,
                borderColor: elegido ? colors.brand.primary : colors.materials.border,
              },
            ]}
          >
            <View
              style={[
                styles.icono,
                { backgroundColor: elegido ? colors.materials.base : colors.materials.highlight },
              ]}
            >
              <Ionicons
                name={icono}
                size={20}
                color={elegido ? colors.brand.primary : colors.text.secondary}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.titulo, { color: colors.text.primary }]}>{titulo}</Text>
              <Text style={[styles.sub, { color: colors.text.tertiary }]}>{sub}</Text>
            </View>
            <Ionicons
              name={elegido ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={elegido ? colors.brand.primary : colors.text.quaternary}
            />
          </Bounceable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: { gap: 10 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  icono: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { fontSize: 16, fontWeight: '900' },
  sub: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
});
