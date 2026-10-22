/**
 * "¿Te vas de vacaciones?": pausa sin costo del plan mensual. Ceti propone la
 * fecha de regreso (el regreso a clases o un mes) y no apura: siempre hay
 * "Ahora no".
 */
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { CetiAnimation } from '@features/animations';
import { BotonChunky } from '@features/dashboard/components/profe/kit';
import { BotonFantasma } from './MuroPlan';
import { fechaLarga } from '../data/planUi';

export default function HojaPausa({
  visible,
  hasta,
  cargando,
  onConfirmar,
  onClose,
}: {
  visible: boolean;
  /** Fecha de regreso propuesta (ms). */
  hasta: number;
  cargando: boolean;
  onConfirmar: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const fecha = fechaLarga(hasta);

  return (
    <CetiBottomSheet
      visible={visible}
      onClose={() => !cargando && onClose()}
      closeOnBackdropPress
      contentOnly
    >
      <Text accessibilityRole="header" style={[styles.titulo, { color: colors.text.primary }]}>
        {t('educadores.suscripcion.pausa.titulo')}
      </Text>

      <View style={styles.ceti}>
        <CetiAnimation id="mascot.ceti-vuelo-reposo" size={90} />
        <View
          style={[
            styles.globo,
            { backgroundColor: colors.fill.brandSubtle, borderColor: colors.materials.border },
          ]}
        >
          <Text style={[styles.globoTexto, { color: colors.text.primary }]}>
            {t('educadores.suscripcion.pausa.ceti')}
          </Text>
        </View>
      </View>

      <Text style={[styles.texto, { color: colors.text.secondary }]}>
        {t('educadores.suscripcion.pausa.texto')}
      </Text>

      <View style={[styles.fecha, { backgroundColor: colors.materials.highlight }]}>
        <Ionicons name="calendar" size={18} color={colors.brand.primary} />
        <Text style={[styles.fechaTexto, { color: colors.text.primary }]}>
          {t('educadores.suscripcion.pausa.hasta', { fecha })}
        </Text>
      </View>

      <Text style={[styles.nota, { color: colors.text.tertiary }]}>
        {t('educadores.suscripcion.pausa.nota')}
      </Text>

      <BotonChunky
        texto={t('educadores.suscripcion.pausa.confirmar', { fecha })}
        icono="pause"
        cargando={cargando}
        onPress={onConfirmar}
      />
      <BotonFantasma texto={t('educadores.muro.ahoraNo')} onPress={() => !cargando && onClose()} />
    </CetiBottomSheet>
  );
}

const styles = StyleSheet.create({
  titulo: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.3 },
  ceti: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  globo: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  globoTexto: { fontSize: 15, lineHeight: 21, fontWeight: '700', fontStyle: 'italic' },
  texto: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  fecha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  fechaTexto: { fontSize: 16, fontWeight: '900' },
  nota: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
