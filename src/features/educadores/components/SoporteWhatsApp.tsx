/**
 * Soporte humano: el WhatsApp del equipo de Ceti, con el número a la vista
 * (seleccionable) y, en web, un botón para copiarlo.
 */
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { showMessage } from '@shared/lib/dialogs';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { BotonChunky, Seccion, Tarjeta } from '@features/dashboard/components/profe/kit';
import { abrirWhatsApp } from './abrirEnlace';
import { formatoNumeroSoporte, numeroSoporte } from '../data/planUi';

export default function SoporteWhatsApp() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const numero = formatoNumeroSoporte(numeroSoporte());
  const puedeCopiar =
    Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.clipboard;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(numero);
      showMessage(t('educadores.soporte.copiado'), undefined, 'success');
    } catch {
      // Sin permiso de portapapeles: el número sigue a la vista y es seleccionable.
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <Seccion texto={t('educadores.soporte.titulo')} />
      <Tarjeta>
        <Text style={[styles.texto, { color: colors.text.secondary }]}>
          {t('educadores.soporte.texto')}
        </Text>
        <Text selectable style={[styles.numero, { color: colors.text.primary }]}>
          {numero}
        </Text>
        <BotonChunky
          texto={t('educadores.soporte.boton')}
          icono="logo-whatsapp"
          color={colors.system.green}
          onPress={() => abrirWhatsApp(t('educadores.soporte.mensaje'))}
        />
        {puedeCopiar ? (
          <View>
            <BotonChunky
              texto={t('educadores.soporte.copiar')}
              icono="copy-outline"
              variante="secundario"
              compacto
              onPress={() => void copiar()}
            />
          </View>
        ) : null}
      </Tarjeta>
    </View>
  );
}

const styles = StyleSheet.create({
  texto: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  numero: { fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: 0.3 },
});
