// app/(parent)/settings.tsx — Configuración Ejecutiva para Padres
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Typography } from '@shared/constants/typography';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { resetAllLocalPersistedStateAndLogout } from '@shared/session/localPersistedState';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';

import { showCetiConfirm } from '@shared/store/useCetiOverlayStore';

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const mode = useThemeStore((s) => s.mode);
  const styles = getStyles(colors, mode);

  const logout = useAuthStore((s) => s.logout);
  const handleReset = () => {
    showCetiConfirm({
      title: 'Reiniciar ecosistema',
      message:
        '¿Seguro? Se borrarán todos los datos locales: ahorro, lecciones, metas, Cetis y el mundo 3D.',
      cancelLabel: 'Cancelar',
      confirmLabel: 'Sí, reiniciar',
      destructive: true,
      onConfirm: () => {
        resetAllLocalPersistedStateAndLogout();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(auth)/choose-role');
      },
    });
  };

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/welcome');
  };

  const handleChangeProfile = () => {
    logout();
    router.replace('/(auth)/choose-role');
  };

  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PageHeader
          overline="Sistema"
          title="Configuración"
          subtitle="Gestión de cuenta y sistema"
        />

        {/* Sección de Apariencia */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Apariencia</Text>
          <View style={styles.optionsList}>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                useThemeStore.getState().toggleTheme();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View style={[styles.optIcon, { backgroundColor: colors.fill.brandSubtle }]}>
                <Ionicons
                  name={mode === 'light' ? 'moon-outline' : 'sunny-outline'}
                  size={20}
                  color={colors.brand.primary}
                />
              </View>
              <Text style={styles.optionText}>
                Cambiar a Modo {mode === 'light' ? 'Oscuro' : 'Claro'}
              </Text>
              <Ionicons name="swap-horizontal" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sección de Cuenta */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cuenta Parental</Text>
          <View style={styles.optionsList}>
            <TouchableOpacity style={styles.optionItem}>
              <View style={[styles.optIcon, { backgroundColor: colors.fill.blueSubtle }]}>
                <Ionicons name="person-outline" size={20} color={colors.system.blue} />
              </View>
              <Text style={styles.optionText}>Editar Perfil Administrativo</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionItem}>
              <View style={[styles.optIcon, { backgroundColor: colors.fill.purpleSubtle }]}>
                <Ionicons name="notifications-outline" size={20} color={colors.system.purple} />
              </View>
              <Text style={styles.optionText}>Alertas de Ahorro</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Seguridad y Datos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seguridad y Datos</Text>
          <View style={styles.optionsList}>
            <TouchableOpacity style={styles.optionItem} onPress={handleReset}>
              <View style={[styles.optIcon, { backgroundColor: colors.fill.redSubtle }]}>
                <Ionicons name="refresh-outline" size={20} color={colors.system.red} />
              </View>
              <Text style={[styles.optionText, { color: colors.system.red }]}>
                Reiniciar Todo el Ecosistema
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionItem} onPress={handleLogout}>
              <View style={[styles.optIcon, { backgroundColor: colors.fill.neutralMuted }]}>
                <Ionicons name="log-out-outline" size={20} color={colors.text.tertiary} />
              </View>
              <Text style={styles.optionText}>Cerrar Sesión</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info de la App */}
        <View style={styles.infoBox}>
          <Text style={styles.version}>Ceti Financial Ecosystem v1.2</Text>
          <Text style={styles.copyright}>© 2024 Ceti Labs. Todos los derechos reservados.</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleChangeProfile}>
            <Text style={styles.logoutText}>Cambiar de perfil</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const getStyles = (colors: any, mode: string) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background.base },
    scroll: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 120, gap: 32 },

    section: { gap: 12 },
    sectionTitle: {
      ...Typography.headline,
      color: colors.text.primary,
      fontWeight: '700',
      fontSize: 14,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    optionsList: {
      backgroundColor: colors.materials.base,
      borderRadius: 24,
      padding: 8,
      borderWidth: 1,
      borderColor: colors.materials.border,
    },
    optionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 16,
    },
    optIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionText: { flex: 1, ...Typography.headline, color: colors.text.primary, fontSize: 14 },

    infoBox: { alignItems: 'center', marginTop: 20, gap: 8 },
    version: { ...Typography.caption1, color: colors.text.secondary, fontWeight: '700' },
    copyright: { ...Typography.caption2, color: colors.text.tertiary },
    logoutBtn: {
      marginTop: 12,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: colors.materials.highlight,
      borderWidth: 1,
      borderColor: colors.materials.border,
    },
    logoutText: { ...Typography.caption1, color: colors.brand.primary, fontWeight: '800' },
  });
