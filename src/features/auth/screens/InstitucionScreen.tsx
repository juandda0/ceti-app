/**
 * Fase 9 — entrar con la cuenta de Google Workspace o Microsoft 365 de la
 * institución. El dominio (opcional) lleva directo al selector de cuentas de
 * la institución. Si la entidad registró ese dominio, el profe encuentra la
 * invitación en Clases al entrar; el estudiante se une a su clase con el
 * código, como siempre. Las rutas públicas (/certificado, /acudiente) no
 * pasan por aquí.
 */
import { useState } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { isFirebaseConfigured } from '@shared/lib/firebase/app';
import { isMicrosoftSignInAvailable, signInWithGoogle, signInWithMicrosoft } from '@shared/lib/firebase/oauth';
import { loginIntent, type LoginIntent } from '@features/auth/data/loginIntent';
import { limpiarDominio, dominioDeCorreo } from '@/functions/src/educadores/dominio/ssoEntidad';
import { Aviso, BotonChunky, Campo, Chip, Encabezado, tapsConTeclado } from '@features/dashboard/components/profe/kit';

export default function InstitucionScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [rol, setRol] = useState<LoginIntent>('profesor');
  const [correo, setCorreo] = useState('');
  const [busy, setBusy] = useState<'google' | 'microsoft' | null>(null);
  const [error, setError] = useState('');

  const entrar = async (con: 'google' | 'microsoft') => {
    if (busy) return;
    setError('');
    setBusy(con);
    loginIntent.set(rol);
    const dominio = dominioDeCorreo(correo) ?? limpiarDominio(correo) ?? undefined;
    try {
      if (con === 'google') await signInWithGoogle(dominio);
      else await signInWithMicrosoft(dominio);
      router.replace('/');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancelad/i.test(msg)) setError(msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]} keyboardShouldPersistTaps={tapsConTeclado} showsVerticalScrollIndicator={false}>
        <Encabezado atras="/(auth)/welcome" sobretitulo={t('institucion.sobre')} titulo={t('institucion.titulo')} subtitulo={t('institucion.sub')} />
        {!isFirebaseConfigured() ? <Aviso icono="cloud-offline" tono="rojo" texto={t('loginCorreo.sinFirebase')} /> : null}
        <View style={{ gap: 10 }}>
          <Text style={[st.etiqueta, { color: colors.text.secondary }]}>{t('loginCorreo.rol')}</Text>
          <View style={st.roles}>
            <Chip grande icono="school" texto={t('roleChooser.profesor')} seleccionado={rol === 'profesor'} onPress={() => setRol('profesor')} />
            <Chip grande icono="rocket" texto={t('roleChooser.estudiante')} seleccionado={rol === 'estudiante'} onPress={() => setRol('estudiante')} />
          </View>
        </View>
        <Campo
          etiqueta={t('institucion.correo')}
          value={correo}
          onChangeText={setCorreo}
          placeholder="tucorreo@micolegio.edu.co"
          tipo="correo"
          ayuda={t('institucion.correoAyuda')}
        />
        {error ? <Aviso icono="alert-circle" tono="rojo" texto={error} /> : null}
        <BotonChunky texto={t('institucion.google')} icono="logo-google" variante="secundario" cargando={busy === 'google'} deshabilitado={busy === 'microsoft'} onPress={() => void entrar('google')} />
        {isMicrosoftSignInAvailable() ? (
          <BotonChunky texto={t('institucion.microsoft')} icono="logo-microsoft" variante="secundario" cargando={busy === 'microsoft'} deshabilitado={busy === 'google'} onPress={() => void entrar('microsoft')} />
        ) : (
          <Text style={[st.ayuda, { color: colors.text.tertiary }]}>{t('institucion.microsoftSoloWeb')}</Text>
        )}
        <Text style={[st.ayuda, { color: colors.text.tertiary }]}>{rol === 'profesor' ? t('institucion.ayudaProfe') : t('institucion.ayudaEstudiante')}</Text>
      </ScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 48, gap: 18 },
  etiqueta: { fontSize: 14, fontWeight: '800' },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ayuda: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
