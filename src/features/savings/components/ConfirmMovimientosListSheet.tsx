/**
 * Confirmación en lote de una frase con varios movimientos (RQ-ES11-CA8). Nada
 * se persiste sin confirmar (extiende RQ-ES10-CA3): cada fila permite corregir el
 * monto, cambiar tipo (tap al icono) o quitarla. La fecha se resuelve en el
 * cliente desde offsetDias/diaSemana (resolverFechaLocal); el servidor nunca
 * conoció la fecha del dispositivo.
 */
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import CetiButton from '@shared/components/CetiButton';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showCetiNotice } from '@shared/store/useCetiOverlayStore';
import { logEvent } from '@shared/lib/analytics/logEvent';
import { formatMoneyInputThousands, parseMoneyAmountInt } from '@shared/utils/moneyInputFormat';
import { CATEGORIA_ICONS } from '@features/savings/components/MovimientoListItem';
import { resolverFechaLocal } from '@features/savings/data/fechaRelativa';
import type { ClasificacionMovimiento } from '@features/savings/data/vozService';
import {
  useMovimientosStore,
  type MovimientoCategoria,
  type MovimientoTipo,
} from '@features/savings/store/useMovimientosStore';

interface Fila {
  tipo: MovimientoTipo;
  montoStr: string;
  descripcion: string;
  categoria: MovimientoCategoria;
  offsetDias: number;
  diaSemana?: string;
  removed: boolean;
}

function aFila(c: ClasificacionMovimiento): Fila {
  return {
    tipo: c.tipo,
    montoStr: c.monto > 0 ? formatMoneyInputThousands(String(c.monto)) : '',
    descripcion: c.descripcion,
    categoria: c.categoria,
    offsetDias: c.offsetDias ?? 0,
    diaSemana: c.diaSemana,
    removed: false,
  };
}

/** Fecha declarada solo cuando no es hoy; hoy usa createdAt (fecha ?? createdAt). */
function fechaDeclarada(f: Fila): number | undefined {
  return f.offsetDias !== 0 || f.diaSemana
    ? resolverFechaLocal(f.offsetDias, f.diaSemana)
    : undefined;
}

export default function ConfirmMovimientosListSheet({
  visible,
  items,
  onClose,
}: {
  visible: boolean;
  items: ClasificacionMovimiento[] | null;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const addMovimiento = useMovimientosStore((s) => s.addMovimiento);
  const [filas, setFilas] = useState<Fila[]>([]);

  useEffect(() => {
    if (visible && items) setFilas(items.map(aFila));
  }, [visible, items]);

  const update = (i: number, patch: Partial<Fila>) =>
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const vivas = filas.filter((f) => !f.removed);

  const handleConfirm = () => {
    const validas = vivas.filter(
      (f) => (parseMoneyAmountInt(f.montoStr) || 0) > 0 && f.descripcion.trim()
    );
    if (validas.length === 0) {
      showCetiNotice({
        variant: 'error',
        title: t('movimientos.reviewTitle'),
        message: t('movimientos.reviewMsg'),
      });
      return;
    }
    for (const f of validas) {
      addMovimiento({
        tipo: f.tipo,
        monto: parseMoneyAmountInt(f.montoStr) || 0,
        descripcion: f.descripcion.trim().slice(0, 140),
        categoria: f.categoria,
        origen: 'voz',
        fecha: fechaDeclarada(f),
      });
    }
    // Analytics sin contenido financiero: solo cuántos (CA9/R4).
    void logEvent('movimientos_multi_confirmado', { cantidad: validas.length });
    showCetiNotice({
      variant: 'success',
      title: t('movimientos.savedTitle'),
      message: t('movimientos.savedMsg'),
    });
    onClose();
  };

  const fechaLabel = (f: Fila): string | null => {
    const fecha = fechaDeclarada(f);
    if (!fecha) return null;
    return new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  return (
    <CetiBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('movimientos.multiTitle')}
      subtitle={t('movimientos.multiSubtitle')}
      closeOnBackdropPress
    >
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {filas.map((f, i) =>
          f.removed ? null : (
            <View key={i} style={[styles.row, { borderColor: colors.materials.border }]}>
              <TouchableOpacity
                onPress={() => update(i, { tipo: f.tipo === 'ahorro' ? 'gasto' : 'ahorro' })}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t(`movimientos.tipo_${f.tipo}`)}
              >
                <Ionicons
                  name={f.tipo === 'ahorro' ? 'trending-up' : 'trending-down'}
                  size={20}
                  color={f.tipo === 'ahorro' ? colors.system.green : colors.system.red}
                />
              </TouchableOpacity>

              <View style={styles.mid}>
                <Text style={[styles.desc, { color: colors.text.primary }]} numberOfLines={1}>
                  {f.descripcion || t(`movimientos.categorias.${f.categoria}`)}
                </Text>
                <View style={styles.metaRow}>
                  <Ionicons
                    name={CATEGORIA_ICONS[f.categoria]}
                    size={12}
                    color={colors.text.tertiary}
                  />
                  <Text style={[styles.meta, { color: colors.text.tertiary }]}>
                    {t(`movimientos.categorias.${f.categoria}`)}
                    {fechaLabel(f) ? ` · ${fechaLabel(f)}` : ''}
                  </Text>
                </View>
              </View>

              <TextInput
                style={[
                  styles.input,
                  { color: colors.text.primary, borderColor: colors.materials.border },
                ]}
                keyboardType="numeric"
                value={f.montoStr}
                onChangeText={(txt) => update(i, { montoStr: formatMoneyInputThousands(txt) })}
                placeholder={t('movimientos.montoPlaceholder')}
                placeholderTextColor={colors.text.tertiary}
                accessibilityLabel={t('movimientos.montoPlaceholder')}
              />

              <TouchableOpacity
                onPress={() => update(i, { removed: true })}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t('movimientos.quitar')}
              >
                <Ionicons name="close-circle" size={22} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>
          )
        )}
      </ScrollView>

      <CetiButton
        label={t('movimientos.confirmarTodos', { count: vivas.length })}
        onPress={handleConfirm}
        variant="primary"
        size="medium"
        style={{ alignSelf: 'stretch', marginTop: 12 }}
      />
    </CetiBottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 340 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  mid: { flex: 1, minWidth: 0, gap: 3 },
  desc: { ...Typography.subheadline, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { ...Typography.caption2 },
  input: {
    ...Typography.body,
    width: 96,
    textAlign: 'right',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
