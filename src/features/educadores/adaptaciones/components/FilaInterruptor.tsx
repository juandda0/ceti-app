/** Fila con título, ayuda y un interruptor (como en las alertas del profe). */
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { useThemeColors } from '@shared/hooks/useThemeColors';

export default function FilaInterruptor({
  titulo,
  ayuda,
  valor,
  onChange,
  deshabilitado = false,
}: {
  titulo: string;
  ayuda: string;
  valor: boolean;
  onChange: (v: boolean) => void;
  deshabilitado?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <View style={st.fila}>
      <View style={st.textos}>
        <Text style={[st.titulo, { color: colors.text.primary }]}>{titulo}</Text>
        <Text style={[st.ayuda, { color: colors.text.secondary }]}>{ayuda}</Text>
      </View>
      <Switch
        value={valor}
        onValueChange={onChange}
        disabled={deshabilitado}
        trackColor={{ true: colors.brand.primary, false: colors.materials.border }}
        thumbColor="#FFFFFF"
        {...(Platform.OS === 'web' ? ({ activeThumbColor: '#FFFFFF' } as object) : {})}
        accessibilityLabel={titulo}
      />
    </View>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textos: { flex: 1, gap: 2 },
  titulo: { fontSize: 15, fontWeight: '900' },
  ayuda: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
});
