/**
 * Cancelar en un paso: una sola hoja que dice qué pasa (prueba, retracto o fin
 * del periodo pagado), que no se borra nada y, si aplica, ofrece una vez pausar
 * en vez de cancelar. "Cancelar igual" se ve tan claro como "Seguir con mi plan".
 */
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { BotonChunky } from '@features/dashboard/components/profe/kit';
import { BotonFantasma } from './MuroPlan';

export default function HojaCancelar({
  visible,
  nombrePlan,
  texto,
  ofrecerPausa,
  cargando,
  onPausarEnVez,
  onConfirmar,
  onClose,
}: {
  visible: boolean;
  nombrePlan: string;
  /** Qué pasa al cancelar (prueba, retracto o fin del periodo), ya traducido. */
  texto: string;
  ofrecerPausa: boolean;
  cargando: boolean;
  onPausarEnVez: () => void;
  onConfirmar: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const cerrar = () => !cargando && onClose();

  return (
    <CetiBottomSheet visible={visible} onClose={cerrar} closeOnBackdropPress contentOnly>
      <Text accessibilityRole="header" style={[styles.titulo, { color: colors.text.primary }]}>
        {t('educadores.suscripcion.cancelacion.titulo', { plan: nombrePlan })}
      </Text>
      <Text style={[styles.texto, { color: colors.text.primary }]}>{texto}</Text>

      <View style={[styles.fila, { backgroundColor: colors.fill.greenSubtle }]}>
        <Ionicons name="shield-checkmark" size={18} color={colors.system.green} />
        <Text style={[styles.filaTexto, { color: colors.text.primary }]}>
          {t('educadores.suscripcion.cancelacion.nadaSeBorra')}
        </Text>
      </View>

      {ofrecerPausa ? (
        <View
          style={[
            styles.pausa,
            { backgroundColor: colors.fill.brandSubtle, borderColor: colors.materials.border },
          ]}
        >
          <Text style={[styles.pausaTexto, { color: colors.text.primary }]}>
            {t('educadores.suscripcion.cancelacion.ofrecePausa')}
          </Text>
          <BotonChunky
            texto={t('educadores.suscripcion.cancelacion.pausarEnVez')}
            icono="pause"
            variante="secundario"
            compacto
            deshabilitado={cargando}
            onPress={onPausarEnVez}
          />
        </View>
      ) : null}

      <BotonChunky
        texto={t('educadores.suscripcion.cancelacion.confirmar')}
        icono="close-circle"
        variante="peligro"
        cargando={cargando}
        onPress={onConfirmar}
      />
      <BotonFantasma texto={t('educadores.suscripcion.cancelacion.seguir')} onPress={cerrar} />
    </CetiBottomSheet>
  );
}

const styles = StyleSheet.create({
  titulo: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.3 },
  texto: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    padding: 14,
  },
  filaTexto: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  pausa: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  pausaTexto: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
});
