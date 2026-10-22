/**
 * "Exportar mis datos": descarga un JSON con las clases del profe, su
 * configuración y el contenido que escribió (nunca datos de estudiantes). Solo
 * en web; en el celular se explica que es desde el computador.
 */
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { showMessage } from '@shared/lib/dialogs';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import type { PlanId } from '@/functions/src/educadores/dominio';
import { Aviso, BotonChunky, Seccion, Tarjeta } from '@features/dashboard/components/profe/kit';
import { exportarMisDatos } from '../data/exportarDatos';

export default function SuscripcionExportar({ plan }: { plan: PlanId }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const uid = useAuthStore((s) => s.firebaseUid);
  const colegioId = useAuthStore((s) => s.colegioId);
  const [preparando, setPreparando] = useState(false);
  const enWeb = Platform.OS === 'web';

  const exportar = async () => {
    if (!uid || !colegioId || preparando) return;
    const usuario = getFirebaseClients()?.auth.currentUser ?? null;
    const correo = usuario?.email ?? null;
    const nombre = usuario?.displayName || correo?.split('@')[0] || null;
    setPreparando(true);
    try {
      const ok = await exportarMisDatos({ uid, colegioId, nombre, correo, plan });
      if (ok) showMessage(t('educadores.exportar.listo'), undefined, 'success');
      else showMessage(t('educadores.exportar.soloWeb'), t('educadores.exportar.soloWebTexto'));
    } catch {
      showMessage(t('educadores.exportar.error'), undefined, 'error');
    } finally {
      setPreparando(false);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <Seccion texto={t('educadores.exportar.titulo')} />
      <Tarjeta>
        <Text style={[styles.texto, { color: colors.text.secondary }]}>
          {t('educadores.exportar.texto')}
        </Text>
        {enWeb ? (
          <>
            <BotonChunky
              texto={t('educadores.exportar.boton')}
              icono="download-outline"
              variante="secundario"
              color={colors.brand.primary}
              cargando={preparando}
              deshabilitado={!uid || !colegioId}
              onPress={() => void exportar()}
            />
            {preparando ? (
              <Text
                style={[styles.preparando, { color: colors.text.tertiary }]}
                accessibilityLiveRegion="polite"
              >
                {t('educadores.exportar.preparando')}
              </Text>
            ) : null}
          </>
        ) : (
          <Aviso icono="desktop-outline" tono="neutro" texto={t('educadores.exportar.soloWeb')}>
            <Text style={[styles.texto, { color: colors.text.secondary }]}>
              {t('educadores.exportar.soloWebTexto')}
            </Text>
          </Aviso>
        )}
      </Tarjeta>
    </View>
  );
}

const styles = StyleSheet.create({
  texto: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  preparando: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
