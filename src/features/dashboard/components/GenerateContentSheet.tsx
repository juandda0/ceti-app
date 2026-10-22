/**
 * Sheet de generación por sección (RQ-CN06, D-ORQ). El profesor pide UNA pieza
 * (pregunta o tarjeta) del tipo de la pestaña actual; puede dar un enfoque
 * opcional. La pieza se genera a partir del mundo y de lo ya escrito y entra al
 * editor como borrador editable — el profesor la revisa antes de guardar.
 *
 * UI copy rule: nunca se muestra "IA"; el disparador es el ícono de destellos.
 *
 * Plan: generar es de Piloto en adelante (`iaAuthoring`) y tiene un cupo al mes.
 * La hoja muestra cuántas ayudas quedan y, si el servidor responde
 * 'limite_ia' o 'requiere_plan', se cierra y abre el muro.
 */
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { BotonChunky, Campo, oscurecer } from '@features/dashboard/components/profe/kit';
import { iaRestante } from '@/functions/src/educadores/dominio';
import { useMiPlan } from '@features/educadores/hooks/useMiPlan';
import { useMuro } from '@features/educadores/components/MuroPlan';
import { suscripcionRepository } from '@features/educadores/data/suscripcionRepository';
import { mesBogota, motivoDeError } from '@features/educadores/data/planUi';

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
  /** Si lanza un error de límite (HttpsError con details.codigo), la hoja abre el muro. */
  onGenerate: (detalle: string) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [detalle, setDetalle] = useState('');
  const uid = useAuthStore((s) => s.firebaseUid);
  const { plan, puede, cargando } = useMiPlan();
  const muro = useMuro();
  const [restantes, setRestantes] = useState<number | null>(null);

  // Limpia el enfoque al cerrar para no arrastrarlo a la próxima generación.
  useEffect(() => {
    if (!visible) setDetalle('');
  }, [visible]);

  // Al abrir: sin la herramienta en el plan, el muro en lugar de la hoja; con ella,
  // cuántas ayudas quedan este mes (se vuelve a leer en cada apertura).
  useEffect(() => {
    if (!visible || cargando) return;
    if (!puede('iaAuthoring')) {
      onClose();
      muro.abrir('iaAuthoring');
      return;
    }
    if (!uid) return;
    let cancelled = false;
    void suscripcionRepository
      .usoIaDelMes(uid, mesBogota(Date.now()))
      .then((usadas) => {
        if (!cancelled) setRestantes(iaRestante(plan, usadas));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // onClose/muro cambian de identidad en cada render del padre; solo importa la apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, cargando, plan, uid]);

  const generar = () => {
    if (restantes === 0) {
      onClose();
      muro.abrir('ia');
      return;
    }
    void Promise.resolve(onGenerate(detalle)).catch((e: unknown) => {
      const motivo = motivoDeError(e, 'iaAuthoring');
      if (!motivo) return;
      onClose();
      muro.abrir(motivo);
    });
  };

  const title =
    kind === 'teoria' ? t('contentEditor.generateCardTitle') : t('contentEditor.generateItemTitle');

  return (
    <>
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
          onPress={generar}
        />
        {restantes !== null ? (
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              textAlign: 'center',
              color: colors.text.tertiary,
            }}
          >
            {t('educadores.muro.iaRestante', { count: restantes })}
          </Text>
        ) : null}
      </CetiBottomSheet>
      {muro.hoja}
    </>
  );
}
