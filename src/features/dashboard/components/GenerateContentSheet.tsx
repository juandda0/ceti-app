/**
 * Sheet de generación por sección (RQ-CN06, D-ORQ). El profesor pide UNA pieza
 * (pregunta o tarjeta) del tipo de la pestaña actual; puede dar un enfoque
 * opcional. La pieza se genera a partir del mundo y de lo ya escrito y entra al
 * editor como borrador editable — el profesor la revisa antes de guardar.
 *
 * UI copy rule: nunca se muestra "IA"; el disparador es el ícono de destellos.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import { useThemeColors } from '@shared/hooks/useThemeColors';

export default function GenerateContentSheet({
  visible,
  kind,
  accent,
  generating,
  onClose,
  onGenerate,
}: {
  visible: boolean;
  kind: 'quiz' | 'teoria';
  accent: string;
  generating: boolean;
  onClose: () => void;
  onGenerate: (detalle: string) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [detalle, setDetalle] = useState('');

  // Limpia el enfoque al cerrar para no arrastrarlo a la próxima generación.
  useEffect(() => {
    if (!visible) setDetalle('');
  }, [visible]);

  const title =
    kind === 'teoria' ? t('contentEditor.generateCardTitle') : t('contentEditor.generateItemTitle');

  return (
    <CetiBottomSheet
      visible={visible}
      onClose={onClose}
      closeOnBackdropPress={!generating}
      title={title}
      subtitle={t('contentEditor.generateSheetSubtitle')}
    >
      <TextInput
        style={[
          styles.input,
          {
            color: colors.text.primary,
            backgroundColor: colors.background.secondary,
            borderColor: colors.materials.border,
          },
        ]}
        value={detalle}
        onChangeText={setDetalle}
        placeholder={t('contentEditor.generateDetallePlaceholder')}
        placeholderTextColor={colors.text.quaternary}
        multiline
        maxLength={300}
        editable={!generating}
      />
      <TouchableOpacity
        onPress={() => onGenerate(detalle)}
        disabled={generating}
        accessibilityRole="button"
        style={[styles.cta, { backgroundColor: accent, opacity: generating ? 0.6 : 1 }]}
      >
        {generating ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="sparkles" size={16} color="#fff" />
        )}
        <Text style={styles.ctaText}>
          {generating ? t('contentEditor.generating') : t('contentEditor.generate')}
        </Text>
      </TouchableOpacity>
    </CetiBottomSheet>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 12,
  },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
