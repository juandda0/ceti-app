/**
 * Tarjeta de confirmación/edición post-clasificación (RQ-ES10 CA3): NADA se
 * persiste sin que el estudiante confirme; todos los campos son corregibles.
 * También es la vía de "editar a mano" cuando la clasificación falla o llega
 * con confianza baja (se abre pre-llenada con el transcript).
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
import { formatMoneyInputThousands, parseMoneyAmountInt } from '@shared/utils/moneyInputFormat';
import { formatDisplayCopGoals } from '@shared/utils/formatDisplayCop';
import { CATEGORIA_ICONS } from '@features/savings/components/MovimientoListItem';
import { resolverFechaLocal } from '@features/savings/data/fechaRelativa';
import type { ClasificacionMovimiento } from '@features/savings/data/vozService';
import {
  MOVIMIENTO_CATEGORIAS,
  useMovimientosStore,
  type MovimientoCategoria,
  type MovimientoTipo,
} from '@features/savings/store/useMovimientosStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';

const CONFIANZA_MINIMA = 0.6;

export default function ConfirmMovimientoSheet({
  visible,
  clasificacion,
  preSelectedGoalId,
  onClose,
}: {
  visible: boolean;
  clasificacion: ClasificacionMovimiento | null;
  preSelectedGoalId?: string;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const goals = useSavingsStore((s) => s.goals);
  const addMovimiento = useMovimientosStore((s) => s.addMovimiento);

  const [tipo, setTipo] = useState<MovimientoTipo>('gasto');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState<MovimientoCategoria>('otros');
  const [goalId, setGoalId] = useState<string | undefined>(undefined);
  // Divulgación progresiva (P1.1): caso feliz = resumen + un tap; el formulario
  // completo solo se abre si la confianza es baja o el estudiante toca "Editar".
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!visible || !clasificacion) return;
    setTipo(clasificacion.tipo);
    setMonto(clasificacion.monto > 0 ? formatMoneyInputThousands(String(clasificacion.monto)) : '');
    setDescripcion(clasificacion.descripcion);
    setCategoria(clasificacion.categoria);
    setGoalId(preSelectedGoalId);
    // Siempre abrir en el RESUMEN con el mejor intento de la IA; el formulario
    // completo solo aparece si el estudiante toca "Editar" (aunque la confianza
    // sea baja, el resumen se muestra con un aviso — nunca el form de entrada).
    setEditing(false);
  }, [visible, clasificacion, preSelectedGoalId]);

  if (!clasificacion) return null;
  const lowConfidence = clasificacion.confianza < CONFIANZA_MINIMA;

  const handleConfirm = () => {
    const num = parseMoneyAmountInt(monto);
    if (!num || !descripcion.trim()) {
      showCetiNotice({
        variant: 'error',
        title: t('movimientos.reviewTitle'),
        message: t('movimientos.reviewMsg'),
      });
      return;
    }
    // Fecha declarada solo si no es hoy; hoy usa createdAt (fecha ?? createdAt).
    const offset = clasificacion.offsetDias ?? 0;
    const fecha =
      offset !== 0 || clasificacion.diaSemana
        ? resolverFechaLocal(offset, clasificacion.diaSemana)
        : undefined;
    addMovimiento({
      tipo,
      monto: num,
      descripcion: descripcion.trim().slice(0, 140),
      categoria,
      origen: 'voz',
      goalId: tipo === 'ahorro' ? goalId : undefined,
      fecha,
    });
    showCetiNotice({
      variant: 'success',
      title: t('movimientos.savedTitle'),
      message: t('movimientos.savedMsg'),
    });
    onClose();
  };

  const chip = (selected: boolean) => [
    styles.chip,
    { backgroundColor: colors.materials.highlight, borderColor: colors.materials.border },
    selected && { borderColor: colors.brand.primary, backgroundColor: colors.fill.brandSubtle },
  ];
  const chipText = (selected: boolean) => [
    styles.chipText,
    { color: selected ? colors.brand.primary : colors.text.primary },
  ];

  return (
    <CetiBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('movimientos.confirmTitle')}
      subtitle={t('movimientos.confirmSubtitle')}
      closeOnBackdropPress
    >
      <View>
        {lowConfidence && (
          <View style={[styles.banner, { backgroundColor: colors.fill.brandSubtle }]}>
            <Text style={[styles.bannerText, { color: colors.text.secondary }]}>
              {t('movimientos.lowConfidence')}
            </Text>
          </View>
        )}

        {!editing && (
          <View style={styles.summary}>
            <Text
              style={[
                styles.summaryAmount,
                { color: tipo === 'ahorro' ? colors.system.green : colors.system.red },
              ]}
            >
              {tipo === 'ahorro' ? '+' : '−'}
              {formatDisplayCopGoals(parseMoneyAmountInt(monto))}
            </Text>
            <Text style={[styles.summaryDesc, { color: colors.text.primary }]} numberOfLines={2}>
              {descripcion}
            </Text>
            <View style={styles.summaryChips}>
              <View style={[styles.sumChip, { backgroundColor: colors.materials.highlight }]}>
                <Ionicons
                  name={tipo === 'ahorro' ? 'trending-up' : 'trending-down'}
                  size={15}
                  color={tipo === 'ahorro' ? colors.system.green : colors.system.red}
                />
                <Text
                  style={[
                    styles.sumChipText,
                    { color: tipo === 'ahorro' ? colors.system.green : colors.system.red },
                  ]}
                >
                  {t(`movimientos.tipo_${tipo}`)}
                </Text>
              </View>
              <View style={[styles.sumChip, { backgroundColor: colors.materials.highlight }]}>
                <Ionicons
                  name={CATEGORIA_ICONS[categoria]}
                  size={15}
                  color={colors.text.secondary}
                />
                <Text style={[styles.sumChipText, { color: colors.text.secondary }]}>
                  {t(`movimientos.categorias.${categoria}`)}
                </Text>
              </View>
              {tipo === 'ahorro' && goalId && (
                <View style={[styles.sumChip, { backgroundColor: colors.fill.brandSubtle }]}>
                  <Ionicons name="flag" size={15} color={colors.brand.primary} />
                  <Text style={[styles.sumChipText, { color: colors.brand.primary }]}>
                    {goals.find((g) => g.id === goalId)?.title ?? t('movimientos.meta')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {editing && (
          <>
            <View style={styles.tipoRow}>
              {(['gasto', 'ahorro'] as const).map((tp) => (
                <TouchableOpacity
                  key={tp}
                  onPress={() => setTipo(tp)}
                  style={chip(tipo === tp)}
                  accessibilityRole="button"
                  accessibilityLabel={t(`movimientos.tipo_${tp}`)}
                >
                  <Text style={chipText(tipo === tp)}>{t(`movimientos.tipo_${tp}`)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.materials.highlight,
                  color: colors.text.primary,
                  borderColor: colors.materials.border,
                },
              ]}
              placeholder={t('movimientos.montoPlaceholder')}
              placeholderTextColor={colors.text.tertiary}
              keyboardType="numeric"
              value={monto}
              onChangeText={(text) => setMonto(formatMoneyInputThousands(text))}
            />
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.materials.highlight,
                  color: colors.text.primary,
                  borderColor: colors.materials.border,
                },
              ]}
              placeholder={t('movimientos.descripcionPlaceholder')}
              placeholderTextColor={colors.text.tertiary}
              value={descripcion}
              onChangeText={setDescripcion}
              maxLength={140}
            />

            <Text style={[styles.label, { color: colors.text.secondary }]}>
              {t('movimientos.categoria')}
            </Text>
            <View style={styles.categoriasWrap}>
              {MOVIMIENTO_CATEGORIAS.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategoria(cat)}
                  style={chip(categoria === cat)}
                  accessibilityRole="button"
                  accessibilityLabel={t(`movimientos.categorias.${cat}`)}
                >
                  <Text style={chipText(categoria === cat)}>
                    {t(`movimientos.categorias.${cat}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {tipo === 'ahorro' && goals.length > 0 && (
              <>
                <Text style={[styles.label, { color: colors.text.secondary }]}>
                  {t('movimientos.meta')}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.metasRow}
                >
                  <TouchableOpacity
                    onPress={() => setGoalId(undefined)}
                    style={chip(!goalId)}
                    accessibilityRole="button"
                    accessibilityLabel={t('movimientos.sinMeta')}
                  >
                    <Text style={chipText(!goalId)}>{t('movimientos.sinMeta')}</Text>
                  </TouchableOpacity>
                  {goals.map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      onPress={() => setGoalId(g.id)}
                      style={chip(goalId === g.id)}
                      accessibilityRole="button"
                      accessibilityLabel={g.title}
                    >
                      <Text style={chipText(goalId === g.id)}>{g.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </>
        )}

        {editing ? (
          <View style={styles.row}>
            <CetiButton
              label={t('movimientos.cancelar')}
              onPress={onClose}
              variant="glass"
              size="medium"
              style={{ flex: 1 }}
            />
            <CetiButton
              label={t('movimientos.confirmar')}
              onPress={handleConfirm}
              variant="primary"
              size="medium"
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <View style={styles.summaryActions}>
            <CetiButton
              label={t('movimientos.confirmar')}
              onPress={handleConfirm}
              variant="primary"
              size="medium"
              style={{ alignSelf: 'stretch' }}
            />
            <TouchableOpacity
              onPress={() => setEditing(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('movimientos.editar')}
              style={styles.editLink}
            >
              <Text style={[styles.editLinkText, { color: colors.text.tertiary }]}>
                {t('movimientos.editar')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </CetiBottomSheet>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 14, padding: 12, marginBottom: 12 },
  bannerText: { ...Typography.caption1 },
  summary: { alignItems: 'center', gap: 12, paddingVertical: 12, marginBottom: 16 },
  summaryAmount: { ...Typography.title1, fontWeight: '900' },
  summaryDesc: { ...Typography.headline, fontWeight: '700', textAlign: 'center' },
  summaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  sumChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  sumChipText: { ...Typography.caption1, fontWeight: '700' },
  summaryActions: { gap: 6 },
  editLink: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  editLinkText: { ...Typography.subheadline, fontWeight: '600' },
  tipoRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: { borderRadius: 20, padding: 20, ...Typography.body, borderWidth: 1, marginBottom: 12 },
  label: { ...Typography.caption1, fontWeight: '700', marginBottom: 8 },
  categoriasWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  metasRow: { marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: { ...Typography.caption1, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
});
