/**
 * Hoja para definir topes semanales por categoría (RQ-ES11-CA1). Escribe en
 * usePresupuestosStore (self-view; el tope es config del usuario, no un rasgo —
 * R5). Un tope vacío/0 elimina la categoría del mapa.
 */
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import {
  MOVIMIENTO_CATEGORIAS,
  type MovimientoCategoria,
} from '@features/savings/store/useMovimientosStore';
import { usePresupuestosStore } from '@features/savings/store/usePresupuestosStore';
import { CATEGORIA_ICONS } from '@features/savings/components/MovimientoListItem';

function soloDigitos(s: string): number | null {
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function PresupuestosSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const topes = usePresupuestosStore((s) => s.topes);
  const setTope = usePresupuestosStore((s) => s.setTope);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.materials.base }]}>
          <View style={styles.header}>
            <View style={styles.headerTexts}>
              <Text style={[styles.title, { color: colors.text.primary }]}>
                {t('presupuestos.titulo')}
              </Text>
              <Text style={[styles.sub, { color: colors.text.secondary }]}>
                {t('presupuestos.subtitulo')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('presupuestos.listo')}
            >
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {MOVIMIENTO_CATEGORIAS.map((cat: MovimientoCategoria) => (
              <View key={cat} style={[styles.row, { borderColor: colors.materials.border }]}>
                <Ionicons name={CATEGORIA_ICONS[cat]} size={20} color={colors.text.secondary} />
                <Text style={[styles.catLabel, { color: colors.text.primary }]} numberOfLines={1}>
                  {t(`movimientos.categorias.${cat}`)}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: colors.text.primary, borderColor: colors.materials.border },
                  ]}
                  keyboardType="numeric"
                  inputMode="numeric"
                  placeholder={t('presupuestos.sinTope')}
                  placeholderTextColor={colors.text.tertiary}
                  defaultValue={topes[cat] ? String(topes[cat]) : ''}
                  onChangeText={(txt) => setTope(cat, soloDigitos(txt))}
                  accessibilityLabel={t('presupuestos.topeDe', {
                    categoria: t(`movimientos.categorias.${cat}`),
                  })}
                />
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.brand.primary }]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.doneText}>{t('presupuestos.listo')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '86%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTexts: { flex: 1, gap: 4 },
  title: { ...Typography.title3, fontWeight: '800' },
  sub: { ...Typography.subheadline },
  list: { marginTop: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  catLabel: { ...Typography.body, flex: 1 },
  input: {
    ...Typography.body,
    minWidth: 110,
    textAlign: 'right',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  doneBtn: { marginTop: 16, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  doneText: { ...Typography.headline, fontWeight: '800', color: '#fff' },
});
