/**
 * Pestaña Perfil del profesor: misma tarjeta central que el perfil del estudiante
 * (avatar con borde de marca, nombre grande), con su rol, su colegio y la salida.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import PrivacyPolicyLink from '@shared/components/PrivacyPolicyLink';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { performLogoutAndGo } from '@features/auth/performLogout';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import {
  Avatar,
  BotonChunky,
  Encabezado,
  Pill,
  Tarjeta,
} from '@features/dashboard/components/profe/kit';

export default function StaffProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);
  const [colegioNombre, setColegioNombre] = useState<string | null>(null);

  const usuario = getFirebaseClients()?.auth.currentUser ?? null;
  const correo = usuario?.email ?? null;
  const nombre = usuario?.displayName || correo?.split('@')[0] || t('profe.profeGenerico');

  useEffect(() => {
    if (!colegioId) return;
    let cancelled = false;
    void rosterRepository.getColegioNombre(colegioId).then((n) => {
      if (!cancelled) setColegioNombre(n);
    });
    return () => {
      cancelled = true;
    };
  }, [colegioId]);

  const fila = (icono: keyof typeof Ionicons.glyphMap, etiqueta: string, valor: string) => (
    <View style={styles.fila}>
      <View style={[styles.filaIcono, { backgroundColor: colors.materials.highlight }]}>
        <Ionicons name={icono} size={18} color={colors.brand.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.filaEtiqueta, { color: colors.text.tertiary }]}>
          {etiqueta.toUpperCase()}
        </Text>
        <Text style={[styles.filaValor, { color: colors.text.primary }]} numberOfLines={1}>
          {valor}
        </Text>
      </View>
    </View>
  );

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado titulo={t('profile.pageTitle')} />

        <Tarjeta style={styles.tarjeta}>
          <View style={[styles.aro, { borderColor: colors.brand.primary }]}>
            <Avatar nombre={nombre} tamano={92} />
          </View>
          <Text style={[styles.nombre, { color: colors.text.primary }]} numberOfLines={1}>
            {nombre}
          </Text>
          {role ? (
            <Pill
              texto={t(`roles.${role}`)}
              tono="marca"
              icono="school"
              style={{ alignSelf: 'center' }}
            />
          ) : null}
        </Tarjeta>

        <Tarjeta style={{ gap: 16 }}>
          {fila('business-outline', t('staff.colegioLabel'), colegioNombre ?? '…')}
          {correo ? fila('mail-outline', t('profe.correo'), correo) : null}
        </Tarjeta>

        <View style={{ gap: 14 }}>
          <BotonChunky
            texto={t('staff.logout')}
            icono="log-out-outline"
            variante="peligro"
            onPress={() => void performLogoutAndGo(router, '/(auth)/welcome')}
          />
          <PrivacyPolicyLink />
        </View>
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 130, gap: 16 },
  tarjeta: { alignItems: 'center', padding: 28, gap: 12, borderRadius: 32 },
  aro: { borderWidth: 3, borderRadius: 999, padding: 4 },
  nombre: { fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 4 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filaIcono: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filaEtiqueta: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  filaValor: { fontSize: 16, fontWeight: '800' },
});
