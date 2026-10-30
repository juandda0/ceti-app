/**
 * Lector del QR de la clase. Abre la cámara solo mientras está visible, lee el
 * enlace de invitación (o el código solo) y devuelve el código. Si no hay
 * permiso, lo pide; si lo niegan, explica cómo escribir el código a mano.
 */
import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Bounceable from '@shared/components/Bounceable';
import { codigoDesdeQr } from '@features/dashboard/data/classCode';
import { BotonChunky } from '@features/dashboard/components/profe/kit';

export default function LectorQrClase({
  visible,
  onCodigo,
  onCerrar,
}: {
  visible: boolean;
  onCodigo: (codigo: string) => void;
  onCerrar: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [noEsDeCeti, setNoEsDeCeti] = useState(false);
  const leido = useRef(false);

  useEffect(() => {
    if (!visible) return;
    leido.current = false;
    setNoEsDeCeti(false);
    if (permiso && !permiso.granted && permiso.canAskAgain) void pedirPermiso();
  }, [visible, permiso, pedirPermiso]);

  const alLeer = ({ data }: { data: string }) => {
    if (leido.current) return;
    const codigo = codigoDesdeQr(data);
    if (!codigo) {
      setNoEsDeCeti(true);
      return;
    }
    leido.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onCodigo(codigo);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View style={st.raiz}>
        {permiso?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={alLeer}
          />
        ) : null}

        <View style={[st.arriba, { paddingTop: insets.top + 12 }]}>
          <Bounceable
            onPress={onCerrar}
            accessibilityRole="button"
            accessibilityLabel={t('miClase.qrCerrar')}
            activeScale={0.9}
            style={st.cerrar}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Bounceable>
        </View>

        {permiso?.granted ? (
          <View style={st.centro} pointerEvents="none">
            <View style={st.marco} />
            <Text style={st.texto}>
              {noEsDeCeti ? t('miClase.qrNoEsDeCeti') : t('miClase.qrApunta')}
            </Text>
          </View>
        ) : (
          <View style={st.centro}>
            <Ionicons name="camera-outline" size={48} color="#FFFFFF" />
            <Text style={st.texto}>
              {permiso && !permiso.canAskAgain ? t('miClase.qrSinPermiso') : t('miClase.qrPermiso')}
            </Text>
            {permiso && permiso.canAskAgain ? (
              <BotonChunky
                texto={t('miClase.qrDarPermiso')}
                icono="camera"
                onPress={() => void pedirPermiso()}
              />
            ) : null}
          </View>
        )}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: '#0C0C22' },
  arriba: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20, zIndex: 2 },
  cerrar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 },
  marco: {
    width: 240,
    height: 240,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: '#FF8A1F',
  },
  texto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
});
