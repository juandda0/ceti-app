/**
 * Elegir cuántos Cetis mover: chips rápidos (25 %, 50 %, Todo) sobre `max` y
 * un ajuste fino con −/+ o escribiendo el número. No recorta lo que se escribe:
 * si pide más de lo que hay, el error lo da la acción.
 */
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';
import { MonedaCeti } from '@features/orbita/components/iconos';
import { haptico } from './comun';

const PASO = 10;
const CHIPS = [
  { clave: 'chip25', parte: 0.25 },
  { clave: 'chip50', parte: 0.5 },
  { clave: 'chipTodo', parte: 1 },
] as const;

export default function SelectorMonto({
  valor,
  max,
  min = 0,
  onCambiar,
}: {
  valor: number;
  /** Lo que se puede mover; los chips se calculan sobre esto. */
  max: number;
  min?: number;
  onCambiar: (n: number) => void;
}) {
  const { t } = useTranslation();
  const sinSaldo = max <= 0;
  const cambiar = (n: number) => {
    haptico.toque();
    onCambiar(Math.max(0, n));
  };

  return (
    <View style={st.raiz}>
      <View style={st.fino}>
        <TouchableOpacity
          onPress={() => cambiar(Math.min(max, valor - PASO))}
          disabled={valor <= 0}
          accessibilityRole="button"
          accessibilityLabel={t('orbita.boveda.menos', { n: PASO })}
          style={[st.paso, valor <= 0 && st.apagado]}
          hitSlop={6}
        >
          <Ionicons name="remove" size={22} color={ESPACIO.texto} />
        </TouchableOpacity>
        <View style={st.campo}>
          <MonedaCeti size={22} />
          <TextInput
            value={valor > 0 ? String(valor) : ''}
            onChangeText={(s) => onCambiar(Number(s.replace(/\D/g, '').slice(0, 6)) || 0)}
            keyboardType="number-pad"
            inputMode="numeric"
            placeholder="0"
            placeholderTextColor={ESPACIO.textoApagado}
            accessibilityLabel={t('orbita.boveda.montoA11y')}
            style={st.input}
            selectTextOnFocus
          />
        </View>
        <TouchableOpacity
          onPress={() => cambiar(Math.min(max, Math.max(min, valor + PASO)))}
          disabled={valor >= max}
          accessibilityRole="button"
          accessibilityLabel={t('orbita.boveda.mas', { n: PASO })}
          style={[st.paso, valor >= max && st.apagado]}
          hitSlop={6}
        >
          <Ionicons name="add" size={22} color={ESPACIO.texto} />
        </TouchableOpacity>
      </View>
      <View style={st.chips}>
        {CHIPS.map(({ clave, parte }) => {
          const n = Math.max(min, Math.floor(max * parte));
          const activo = !sinSaldo && valor === n;
          return (
            <TouchableOpacity
              key={clave}
              onPress={() => cambiar(n)}
              disabled={sinSaldo || n > max}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              style={[st.chip, activo && st.chipActivo, (sinSaldo || n > max) && st.apagado]}
            >
              <Text style={[st.chipTexto, activo && { color: ESPACIO.textoSobreNaranja }]}>
                {t(`orbita.boveda.${clave}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  raiz: { gap: 10 },
  fino: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paso: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: ESPACIO.boton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apagado: { opacity: 0.4 },
  campo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: ESPACIO.fondoProfundo,
    borderWidth: 1,
    borderColor: ESPACIO.linea,
    paddingHorizontal: 12,
  },
  input: {
    minWidth: 60,
    maxWidth: 140,
    color: ESPACIO.texto,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: ESPACIO.boton,
  },
  chipActivo: { backgroundColor: ESPACIO.oro },
  chipTexto: { color: ESPACIO.texto, fontSize: 13, fontWeight: '800' },
});
