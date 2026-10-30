/**
 * Hoja "Mi banco" en el editor de contenido (Fase 4): busca entre las
 * preguntas guardadas del profe (por texto o tema), del mismo tipo que la
 * pestaña abierta, y agrega una copia al mundo. También se borran desde aquí.
 */
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import type { QuizItem } from '@features/learning/data/quiz.types';
import { filtrarBanco, type PreguntaGuardada } from '@features/dashboard/data/bancoProfe';
import { bancoProfeRepository } from '@features/dashboard/data/bancoProfeRepository';
import { Campo, Chip, Esqueleto } from '@features/dashboard/components/profe/kit';

export default function HojaMiBanco({
  visible,
  uid,
  tipo,
  acento,
  onElegir,
  onCerrar,
}: {
  visible: boolean;
  uid: string;
  tipo: QuizItem['tipo'];
  acento: string;
  onElegir: (item: QuizItem) => void;
  onCerrar: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [banco, setBanco] = useState<PreguntaGuardada[] | null>(null);
  const [texto, setTexto] = useState('');
  const [tema, setTema] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !uid) return;
    setBanco(null);
    void bancoProfeRepository
      .listar(uid)
      .then(setBanco)
      .catch(() => setBanco([]));
  }, [visible, uid]);

  const delTipo = useMemo(() => (banco ?? []).filter((p) => p.tipo === tipo), [banco, tipo]);
  const temas = useMemo(() => [...new Set(delTipo.flatMap((p) => p.temas))].sort(), [delTipo]);
  const lista = filtrarBanco(delTipo, { texto, tema });

  const borrar = async (p: PreguntaGuardada) => {
    try {
      await bancoProfeRepository.borrar(uid, p.id);
      setBanco((b) => (b ?? []).filter((x) => x.id !== p.id));
    } catch (e) {
      showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
    }
  };

  return (
    <CetiBottomSheet
      visible={visible}
      onClose={onCerrar}
      title={t('miBanco.titulo')}
      subtitle={t('miBanco.subtitulo')}
      closeOnBackdropPress
    >
      <View style={st.vista}>
        <Campo
          value={texto}
          onChangeText={setTexto}
          placeholder={t('miBanco.buscar')}
          acento={acento}
        />
        {temas.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.chips}
          >
            <Chip
              texto={t('miBanco.todos')}
              seleccionado={tema === null}
              color={acento}
              onPress={() => setTema(null)}
            />
            {temas.map((x) => (
              <Chip
                key={x}
                texto={x}
                seleccionado={tema === x}
                color={acento}
                onPress={() => setTema(x)}
              />
            ))}
          </ScrollView>
        ) : null}
        {banco == null ? (
          <Esqueleto filas={3} alto={56} />
        ) : lista.length === 0 ? (
          <Text style={[st.vacio, { color: colors.text.tertiary }]}>
            {delTipo.length === 0 ? t('miBanco.vacio') : t('miBanco.sinResultados')}
          </Text>
        ) : (
          <ScrollView style={st.lista} contentContainerStyle={{ gap: 8 }}>
            {lista.map((p) => (
              <View key={p.id} style={[st.fila, { borderColor: colors.materials.border }]}>
                <View style={st.flex}>
                  <Text style={[st.enunciado, { color: colors.text.primary }]} numberOfLines={3}>
                    {p.item.enunciado}
                  </Text>
                  {p.temas.length > 0 ? (
                    <Text style={[st.temas, { color: colors.text.tertiary }]} numberOfLines={1}>
                      {p.temas.join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <Bounceable
                  onPress={() => {
                    // Copia con id nuevo: la del banco queda igual.
                    onElegir({ ...p.item, id: `p_${Date.now().toString(36)}` });
                    showMessage(t('miBanco.agregada'), undefined, 'success');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('miBanco.agregar')}
                  style={[st.icono, { backgroundColor: acento + '26' }]}
                >
                  <Ionicons name="add" size={20} color={colors.text.primary} />
                </Bounceable>
                <Bounceable
                  onPress={() => void borrar(p)}
                  accessibilityRole="button"
                  accessibilityLabel={t('miBanco.borrar')}
                  style={[st.icono, { backgroundColor: colors.fill.redSubtle }]}
                >
                  <Ionicons name="trash-outline" size={17} color={colors.system.red} />
                </Bounceable>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </CetiBottomSheet>
  );
}

const st = StyleSheet.create({
  vista: { gap: 12, paddingBottom: 8 },
  chips: { gap: 8 },
  lista: { maxHeight: 380 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  flex: { flex: 1, gap: 4 },
  enunciado: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  temas: { fontSize: 12, fontWeight: '700' },
  icono: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vacio: { fontSize: 14, fontWeight: '600', paddingVertical: 12 },
});
