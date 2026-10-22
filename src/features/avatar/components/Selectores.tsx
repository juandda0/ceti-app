import { View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Bounceable from '@shared/components/Bounceable';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import AvatarView from '@features/avatar/components/AvatarView';
import { PERSONAJES, type AvatarConfig, type PersonajeId } from '@features/avatar/domain/catalogo';

/** Fila de tripulantes: retrato con el tono y pelo elegidos, para comparar. */
export function SelectorPersonaje({
  config,
  onChange,
}: {
  config: AvatarConfig;
  onChange: (personaje: PersonajeId) => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.fila}>
      {PERSONAJES.map((p) => {
        const activo = p.id === config.personaje;
        return (
          <Bounceable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={p.nombre}
            accessibilityState={{ selected: activo }}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(p.id);
            }}
            style={[
              styles.ficha,
              {
                backgroundColor: activo ? colors.fill.brandSubtle : colors.materials.base,
                borderColor: activo ? colors.brand.primary : colors.materials.border,
              },
            ]}
          >
            <AvatarView
              config={{ ...config, personaje: p.id, prenda: 'traje', accesorio: null }}
              encuadre="retrato"
              size={56}
            />
            <Text style={[styles.nombre, { color: colors.text.primary }]}>{p.nombre}</Text>
          </Bounceable>
        );
      })}
    </View>
  );
}

/** Fila de muestras de color (tono de piel o color de pelo). */
export function SelectorColor<T extends string>({
  titulo,
  opciones,
  valor,
  onChange,
  etiqueta,
}: {
  titulo: string;
  opciones: readonly { id: T; hex: string }[];
  valor: T;
  onChange: (id: T) => void;
  etiqueta: (id: T) => string;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.bloque}>
      <Text style={[styles.titulo, { color: colors.text.secondary }]}>
        {titulo} · {etiqueta(valor)}
      </Text>
      <View style={styles.muestras}>
        {opciones.map((o) => {
          const activo = o.id === valor;
          return (
            <Bounceable
              key={o.id}
              accessibilityRole="button"
              accessibilityLabel={`${titulo}: ${etiqueta(o.id)}`}
              accessibilityState={{ selected: activo }}
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(o.id);
              }}
              style={[
                styles.muestra,
                {
                  backgroundColor: o.hex,
                  borderColor: activo ? colors.brand.primary : colors.materials.border,
                },
              ]}
            >
              <View style={[styles.muestraAro, { borderColor: colors.background.base }]} />
            </Bounceable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  ficha: {
    flex: 1,
    maxWidth: 110,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
  },
  nombre: { ...Typography.footnote, fontWeight: '700' },
  bloque: { gap: 10, width: '100%' },
  titulo: { ...Typography.subheadline, fontWeight: '700' },
  muestras: { flexDirection: 'row', justifyContent: 'space-between' },
  muestra: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muestraAro: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 3,
  },
});
