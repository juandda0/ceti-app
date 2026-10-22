/**
 * Acceso con correo — SOLO para pruebas del equipo (probar cuentas con distintos
 * roles sin Google). Los usuarios entran desde la bienvenida con "Entrar como
 * estudiante / profe". El rol elegido aquí solo cuenta para una cuenta nueva: a
 * una cuenta que ya tiene rol la gobiernan sus claims.
 */
import { useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { isFirebaseConfigured } from '@shared/lib/firebase/app';
import { createAccountWithEmail, signInWithEmail } from '@shared/lib/firebase/emailAuth';
import { loginIntent, type LoginIntent } from '@features/auth/data/loginIntent';
import {
  Aviso,
  BotonChunky,
  Campo,
  Chip,
  Encabezado,
  tapsConTeclado,
} from '@features/dashboard/components/profe/kit';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [rol, setRol] = useState<LoginIntent>('estudiante');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [busy, setBusy] = useState<'entrar' | 'crear' | null>(null);
  const [error, setError] = useState('');

  const enviar = async (modo: 'entrar' | 'crear') => {
    if (busy) return;
    if (!correo.trim() || !clave) {
      setError(t('loginCorreo.faltan'));
      return;
    }
    setError('');
    setBusy(modo);
    loginIntent.set(rol);
    try {
      if (modo === 'entrar') await signInWithEmail(correo, clave);
      else await createAccountWithEmail(correo, clave);
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps={tapsConTeclado}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          atras="/(auth)/welcome"
          sobretitulo={t('loginCorreo.sobretitulo')}
          titulo={t('loginCorreo.titulo')}
          subtitulo={t('loginCorreo.subtitulo')}
        />

        {!isFirebaseConfigured() ? (
          <Aviso icono="cloud-offline" tono="rojo" texto={t('loginCorreo.sinFirebase')} />
        ) : (
          <>
            <View style={{ gap: 10 }}>
              <Text style={[styles.etiqueta, { color: colors.text.secondary }]}>
                {t('loginCorreo.rol')}
              </Text>
              <View style={styles.roles}>
                <Chip
                  grande
                  icono="rocket"
                  texto={t('roleChooser.estudiante')}
                  seleccionado={rol === 'estudiante'}
                  onPress={() => setRol('estudiante')}
                />
                <Chip
                  grande
                  icono="school"
                  texto={t('roleChooser.profesor')}
                  seleccionado={rol === 'profesor'}
                  onPress={() => setRol('profesor')}
                />
              </View>
              <Text style={[styles.ayuda, { color: colors.text.tertiary }]}>
                {t('loginCorreo.rolAyuda')}
              </Text>
            </View>

            <Campo
              etiqueta={t('loginCorreo.correo')}
              value={correo}
              onChangeText={setCorreo}
              placeholder="profe1@prueba.ceti"
              tipo="correo"
            />
            <Campo
              etiqueta={t('loginCorreo.clave')}
              value={clave}
              onChangeText={setClave}
              placeholder="••••••"
              tipo="clave"
            />

            {error ? <Aviso icono="alert-circle" tono="rojo" texto={error} /> : null}

            <View style={{ gap: 12 }}>
              <BotonChunky
                texto={t('loginCorreo.entrar')}
                icono="log-in"
                cargando={busy === 'entrar'}
                deshabilitado={busy === 'crear'}
                onPress={() => void enviar('entrar')}
              />
              <BotonChunky
                texto={t('loginCorreo.crear')}
                icono="person-add"
                variante="secundario"
                cargando={busy === 'crear'}
                deshabilitado={busy === 'entrar'}
                onPress={() => void enviar('crear')}
              />
            </View>
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 48, gap: 18 },
  etiqueta: { fontSize: 14, fontWeight: '800' },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ayuda: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
});
