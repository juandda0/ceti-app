import { Redirect, Stack, type Href } from 'expo-router';
import { useAuthStore, isStaffRole, useIsAdmin } from '@features/auth/store/useAuthStore';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { usePushCeti } from '@features/dashboard/hooks/usePushCeti';

// Las pestañas (Clases · Colegio · Perfil) quedan debajo de toda pantalla de
// detalle, también al entrar por enlace directo: "volver" siempre llega a ellas.
export const unstable_settings = { initialRouteName: '(tabs)' };

/**
 * Route group for school staff. Non-staff are bounced out (welcome / their app).
 * Stack: las pestañas del profesor y, encima, las pantallas de detalle.
 */
export default function StaffLayout() {
  const authReady = useAuthStore((s) => s.authReady);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);
  const isAdmin = useIsAdmin();
  const colors = useThemeColors();
  usePushCeti();

  if (authReady && !isStaffRole(role) && !isAdmin) {
    // Destino explícito fuera del grupo: con las pestañas anidadas, `/` vuelve a
    // resolver dentro de (staff) y el guard se redirige a sí mismo sin fin.
    return <Redirect href={(isAuthenticated ? '/(app)/saga' : '/(auth)/welcome') as Href} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 200,
        contentStyle: { backgroundColor: colors.background.base },
      }}
    />
  );
}
