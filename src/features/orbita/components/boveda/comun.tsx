/**
 * Piezas comunes de la Bóveda: formato de Cetis y fechas, hápticos suaves
 * (en web no vibran y su promesa puede rechazar) y la tarjeta espacial.
 */
import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';

export const VERDE = '#5FD39A';
export const VERDE_SUAVE = '#16302A';
export const CIAN = '#5FCFC8';
export const ROJO = '#FF7A7A';
export const SATURNO = '#E8B86B';

export function formato(n: number): string {
  return n.toLocaleString('es-CO');
}

/** "4 nov." a partir de una clave `YYYY-MM-DD` (sin depender de la zona del teléfono). */
export function fechaCorta(clave: string): string {
  const [y, m, d] = clave.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

const enWeb = Platform.OS === 'web';

export const haptico = {
  toque: () => {
    if (!enWeb) void Haptics.selectionAsync();
  },
  exito: () => {
    if (!enWeb) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  aviso: () => {
    if (!enWeb) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
};

export function Tarjeta({
  titulo,
  icono,
  accion,
  children,
  style,
}: {
  titulo?: string;
  icono?: ReactNode;
  accion?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[st.tarjeta, style]}>
      {titulo ? (
        <View style={st.cabecera}>
          {icono}
          <Text style={st.titulo} accessibilityRole="header">
            {titulo}
          </Text>
          <View style={{ flex: 1 }} />
          {accion}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export const comun = StyleSheet.create({
  sub: { color: ESPACIO.textoSuave, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  nota: { color: ESPACIO.textoApagado, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  num: { fontVariant: ['tabular-nums'] },
  error: { color: ROJO, fontSize: 13, fontWeight: '700' },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ESPACIO.naranja,
    borderRadius: 14,
    paddingHorizontal: 18,
    minHeight: 48,
  },
  botonTexto: { fontSize: 15, fontWeight: '900', color: ESPACIO.textoSobreNaranja },
  botonFantasma: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: ESPACIO.linea,
    paddingHorizontal: 12,
    minHeight: 36,
  },
  botonFantasmaTexto: { fontSize: 13, fontWeight: '800', color: ESPACIO.textoSuave },
});

const st = StyleSheet.create({
  tarjeta: {
    backgroundColor: ESPACIO.superficieBaja,
    borderWidth: 1,
    borderColor: ESPACIO.linea,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { color: ESPACIO.texto, fontSize: 16, fontWeight: '900' },
});
