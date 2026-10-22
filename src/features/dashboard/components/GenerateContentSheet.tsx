/**
 * Sheet de generación por sección (RQ-CN06, D-ORQ). El profesor pide UNA pieza
 * (pregunta o tarjeta) del tipo de la pestaña actual; puede dar un enfoque
 * opcional. La pieza se genera a partir del mundo y de lo ya escrito y entra al
 * editor como borrador editable — el profesor la revisa antes de guardar.
 *
 * UI copy rule: nunca se muestra "IA"; el disparador es el ícono de destellos.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import { BotonChunky, Campo, oscurecer } from '@features/dashboard/components/profe/kit';

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
      <Campo
        value={detalle}
        onChangeText={setDetalle}
        placeholder={t('contentEditor.generateDetallePlaceholder')}
        multiline
        maxLength={300}
        editable={!generating}
        acento={accent}
      />
      <BotonChunky
        texto={generating ? t('contentEditor.generating') : t('contentEditor.generate')}
        icono="sparkles"
        color={accent}
        colorOscuro={oscurecer(accent)}
        cargando={generating}
        onPress={() => onGenerate(detalle)}
      />
    </CetiBottomSheet>
  );
}
