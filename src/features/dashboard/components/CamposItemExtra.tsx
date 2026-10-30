/**
 * Campos del editor para los tipos que escribe el profe (Fase 4): emparejar,
 * completar el espacio y respuesta numérica. El enunciado se edita afuera,
 * como en los demás tipos.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import type {
  CompletarItem,
  EmparejarItem,
  NumericaItem,
  QuizItemExtra,
} from '@features/learning/data/quiz.types';
import { MAX_PARES, MIN_PARES, leerNumero } from '@features/learning/data/tiposExtra';
import { Campo, Chip } from '@features/dashboard/components/profe/kit';

export default function CamposItemExtra({
  item,
  acento,
  onChange,
}: {
  item: QuizItemExtra;
  acento: string;
  onChange: (patch: Partial<QuizItemExtra>) => void;
}) {
  if (item.tipo === 'emparejar')
    return <CamposEmparejar item={item} acento={acento} onChange={onChange} />;
  if (item.tipo === 'completar')
    return <CamposCompletar item={item} acento={acento} onChange={onChange} />;
  return <CamposNumerica item={item} acento={acento} onChange={onChange} />;
}

function CamposEmparejar({
  item,
  acento,
  onChange,
}: {
  item: EmparejarItem;
  acento: string;
  onChange: (patch: Partial<EmparejarItem>) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const cambiar = (i: number, lado: 'izquierda' | 'derecha', v: string) =>
    onChange({ pares: item.pares.map((p, k) => (k === i ? { ...p, [lado]: v } : p)) });
  return (
    <View style={st.bloque}>
      <Text style={[st.etiqueta, { color: colors.text.secondary }]}>{t('camposExtra.pares')}</Text>
      {item.pares.map((p, i) => (
        <View key={i} style={st.par}>
          <View style={st.flex}>
            <Campo
              value={p.izquierda}
              onChangeText={(v) => cambiar(i, 'izquierda', v)}
              placeholder={t('camposExtra.concepto')}
              maxLength={80}
              acento={acento}
            />
          </View>
          <Ionicons name="arrow-forward" size={16} color={colors.text.tertiary} />
          <View style={st.flex}>
            <Campo
              value={p.derecha}
              onChangeText={(v) => cambiar(i, 'derecha', v)}
              placeholder={t('camposExtra.pareja')}
              maxLength={80}
              acento={acento}
            />
          </View>
          <Bounceable
            onPress={() => onChange({ pares: item.pares.filter((_, k) => k !== i) })}
            disabled={item.pares.length <= MIN_PARES}
            accessibilityRole="button"
            accessibilityLabel={t('camposExtra.quitarPar')}
            style={st.icono}
          >
            <Ionicons
              name="close"
              size={18}
              color={item.pares.length <= MIN_PARES ? colors.text.quaternary : colors.system.red}
            />
          </Bounceable>
        </View>
      ))}
      {item.pares.length < MAX_PARES ? (
        <Chip
          texto={t('camposExtra.agregarPar')}
          icono="add"
          color={acento}
          seleccionado={false}
          onPress={() => onChange({ pares: [...item.pares, { izquierda: '', derecha: '' }] })}
        />
      ) : null}
      <Text style={[st.ayuda, { color: colors.text.tertiary }]}>{t('camposExtra.paresAyuda')}</Text>
    </View>
  );
}

function CamposCompletar({
  item,
  acento,
  onChange,
}: {
  item: CompletarItem;
  acento: string;
  onChange: (patch: Partial<CompletarItem>) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <View style={st.bloque}>
      <Text style={[st.ayuda, { color: colors.text.tertiary }]}>
        {t('camposExtra.espacioAyuda')}
      </Text>
      <Text style={[st.etiqueta, { color: colors.text.secondary }]}>
        {t('camposExtra.opciones')}
      </Text>
      {item.opciones.map((o, i) => (
        <View key={i} style={st.par}>
          <Bounceable
            onPress={() => onChange({ correctIndex: i })}
            accessibilityRole="radio"
            accessibilityState={{ selected: item.correctIndex === i }}
            accessibilityLabel={t('camposExtra.marcarCorrecta')}
            style={st.icono}
          >
            <Ionicons
              name={item.correctIndex === i ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={item.correctIndex === i ? colors.system.green : colors.text.tertiary}
            />
          </Bounceable>
          <View style={st.flex}>
            <Campo
              value={o}
              onChangeText={(v) =>
                onChange({ opciones: item.opciones.map((x, k) => (k === i ? v : x)) })
              }
              placeholder={t('camposExtra.opcionN', { n: i + 1 })}
              maxLength={60}
              acento={acento}
            />
          </View>
          <Bounceable
            onPress={() =>
              onChange({
                opciones: item.opciones.filter((_, k) => k !== i),
                correctIndex:
                  item.correctIndex === i
                    ? 0
                    : item.correctIndex > i
                      ? item.correctIndex - 1
                      : item.correctIndex,
              })
            }
            disabled={item.opciones.length <= 2}
            accessibilityRole="button"
            accessibilityLabel={t('camposExtra.quitarOpcion')}
            style={st.icono}
          >
            <Ionicons
              name="close"
              size={18}
              color={item.opciones.length <= 2 ? colors.text.quaternary : colors.system.red}
            />
          </Bounceable>
        </View>
      ))}
      {item.opciones.length < 5 ? (
        <Chip
          texto={t('camposExtra.agregarOpcion')}
          icono="add"
          color={acento}
          seleccionado={false}
          onPress={() => onChange({ opciones: [...item.opciones, ''] })}
        />
      ) : null}
    </View>
  );
}

function CamposNumerica({
  item,
  acento,
  onChange,
}: {
  item: NumericaItem;
  acento: string;
  onChange: (patch: Partial<NumericaItem>) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  // Se edita como texto para aceptar "1.500" o "2,5" mientras se escribe.
  const [respuesta, setRespuesta] = useState(String(item.respuesta ?? '').replace('.', ','));
  const [tolerancia, setTolerancia] = useState(String(item.tolerancia ?? 0).replace('.', ','));
  return (
    <View style={st.bloque}>
      <View style={st.par}>
        <View style={st.flex}>
          <Campo
            etiqueta={t('camposExtra.respuesta')}
            value={respuesta}
            onChangeText={(v) => {
              setRespuesta(v);
              const n = leerNumero(v);
              onChange({ respuesta: n ?? Number.NaN });
            }}
            placeholder="1.500"
            acento={acento}
          />
        </View>
        <View style={st.flex}>
          <Campo
            etiqueta={t('camposExtra.unidad')}
            value={item.unidad ?? ''}
            onChangeText={(v) => onChange({ unidad: v.trim() ? v : undefined })}
            placeholder={t('camposExtra.unidadEjemplo')}
            maxLength={20}
            acento={acento}
          />
        </View>
      </View>
      <Campo
        etiqueta={t('camposExtra.tolerancia')}
        value={tolerancia}
        onChangeText={(v) => {
          setTolerancia(v);
          const n = leerNumero(v || '0');
          onChange({ tolerancia: n ?? Number.NaN });
        }}
        placeholder="0"
        ayuda={t('camposExtra.toleranciaAyuda')}
        acento={acento}
      />
    </View>
  );
}

const st = StyleSheet.create({
  bloque: { gap: 10 },
  etiqueta: { fontSize: 14, fontWeight: '800' },
  ayuda: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  par: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  icono: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
